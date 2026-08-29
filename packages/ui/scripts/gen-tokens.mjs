#!/usr/bin/env node
/**
 * gen-tokens.mjs — generate a retinted copy of rn-motion-ui's tokens.css.
 *
 * Usage (from a consuming project):
 *   npx rn-motion-ui-tokens --hue 250 --chroma 0.006
 *   npx rn-motion-ui-tokens --chroma 0 --out src/styles/tokens.css
 *   npx rn-motion-ui-tokens --stdout | less
 *
 * Then import the result INSTEAD of "rn-motion-ui/tokens.css":
 *   @import "tailwindcss";
 *   @import "uniwind";
 *   @import "./tokens.css";
 *
 * ## Why a generator and not CSS variables
 *
 * The obvious design — `oklch(20.5% var(--neutral-chroma) var(--neutral-hue))` —
 * cannot work on native. uniwind's native compiler folds colours to hex at build
 * time with culori, and a var() inside a colour function has no value at that
 * point: Color.processColor falls through to a template literal, so the style
 * ends up holding the *string* `rt.parseColor("oklch", …)` instead of a colour.
 * (Numeric custom properties are also serialised through
 * `roundToPrecision(value, 2)`, which flattens a 0.004 chroma to 0.)
 *
 * So every tinted token in tokens.css spells its chroma and hue out literally,
 * and retinting the palette is a codegen step rather than a runtime one.
 *
 * ## What it does
 *
 * Reads the tokens.css shipped inside this package, rewrites every `oklch()`
 * declaration that carries the neutral tint, and passes everything else through
 * verbatim — comments, shadow recipes, surface rims, the @theme block and both
 * @variant blocks, and any token added upstream. The rewrite is structural only
 * in the sense that it does not care about structure: it walks every `oklch()`
 * in the file wherever it sits, so adding or reshaping a theme block upstream
 * needs no change here. A declaration counts as tinted when its
 * hue equals the source `--neutral-hue` and its chroma is above zero and no
 * greater than the source `--neutral-chroma`; chroma is then scaled
 * proportionally, so a token authored at half tint (primary-foreground) stays at
 * half tint. Status colours (danger/success/warning/info) carry their own
 * hues and much larger chromas, so they are left alone.
 *
 * Running with neither --hue nor --chroma reproduces the shipped sheet byte for
 * byte apart from the generated header, which makes that the cheapest self-test.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = resolve(__dirname, '../src/theme/tokens.css');
const PKG_JSON_PATH = resolve(__dirname, '../package.json');

const DEFAULT_OUT = 'tokens.css';
// sRGB tops out near 0.37; 0.4 is the CSS Color 4 reference for chroma 100%.
const MAX_CHROMA = 0.4;

const USAGE = `rn-motion-ui-tokens — generate a retinted tokens.css

Usage:
  npx rn-motion-ui-tokens [options]

Options:
  --hue <deg>     Neutral hue in degrees. Cyclic, so -20 and 400 are fine.
                  (default: the shipped sheet's --neutral-hue)
  --chroma <c>    Neutral chroma, 0-${MAX_CHROMA}. 0 removes the tint entirely.
                  (default: the shipped sheet's --neutral-chroma)
  --out <path>    Output file, relative to the cwd. (default: ./${DEFAULT_OUT})
  --force, -f     Overwrite the output file if it already exists.
  --stdout        Write to stdout instead of a file.
  --help, -h      Show this message.

Examples:
  npx rn-motion-ui-tokens --hue 250 --chroma 0.006
  npx rn-motion-ui-tokens --chroma 0 --out src/styles/tokens.css --force

Import the result instead of "rn-motion-ui/tokens.css" in your global CSS.
`;

function fail(message) {
  console.error(`✖  ${message}\n`);
  console.error(USAGE);
  process.exit(1);
}

/** 0.0060000000000000005 -> "0.006", 270 -> "270", 0 -> "0". */
function formatNumber(value) {
  return String(Number(value.toFixed(6)));
}

// ---------------------------------------------------------------------------
// Source sheet
// ---------------------------------------------------------------------------

/**
 * The token sheet shipped with this package. Resolved relative to this script so
 * it works both from a checkout (packages/ui/scripts/) and from node_modules.
 */
function readSource() {
  if (!existsSync(SOURCE_PATH)) {
    console.error(`✖  Could not find the source token sheet at ${SOURCE_PATH}`);
    process.exit(1);
  }
  return readFileSync(SOURCE_PATH, 'utf8');
}

function readVersion() {
  try {
    return JSON.parse(readFileSync(PKG_JSON_PATH, 'utf8')).version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

// The tint the sheet was authored with. Declared in :root, so it is discovered
// from the sheet rather than hardcoded here — an upstream retune is picked up
// without touching this script.
const NEUTRAL_HUE_RE = /--neutral-hue:\s*([\d.]+)\s*;/;
const NEUTRAL_CHROMA_RE = /--neutral-chroma:\s*([\d.]+)\s*;/;

function readNeutral(css) {
  const hue = NEUTRAL_HUE_RE.exec(css);
  const chroma = NEUTRAL_CHROMA_RE.exec(css);
  if (!(hue && chroma)) {
    console.error('✖  The source sheet declares no --neutral-hue / --neutral-chroma; cannot detect the tint to rewrite.');
    process.exit(1);
  }
  return {
    hue: Number.parseFloat(hue[1]),
    chroma: Number.parseFloat(chroma[1]),
    rawHue: hue[1],
    rawChroma: chroma[1],
  };
}

// ---------------------------------------------------------------------------
// Retinting
// ---------------------------------------------------------------------------

// Every oklch() literal in the sheet. Lightness and alpha may be percentages or
// 0-1 numbers, hue may carry a `deg` suffix — mirrors lib/color.ts's OKLCH_RE,
// but unanchored and global so it walks the whole file.
const OKLCH_RE = /oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+%?)\s*)?\)/gi;

/** Chroma as a 0-0.4 number; percentages scale to 0.4 = 100% per CSS Color 4. */
function parseChroma(raw) {
  const value = Number.parseFloat(raw);
  return raw.endsWith('%') ? (value / 100) * MAX_CHROMA : value;
}

/**
 * Rewrite every neutral-tinted oklch() literal to the target hue/chroma.
 *
 * The tint test is "same hue as --neutral-hue, chroma in (0, --neutral-chroma]".
 * That excludes the achromatic tokens (`oklch(97% 0 0)`, the white/black state
 * overlays and shadow layers, all of which are hue 0 chroma 0) and the status
 * colours, whose chromas are two orders of magnitude larger.
 *
 * Chroma is scaled proportionally rather than replaced, so a token authored at a
 * partial tint keeps its relationship to the ladder: primary-foreground sits at
 * 0.002 against a 0.004 neutral, i.e. half, and stays half after retinting.
 */
function retint(css, source, target) {
  let count = 0;
  const out = css.replace(OKLCH_RE, (match, lightness, rawChroma, rawHue, alpha) => {
    const chroma = parseChroma(rawChroma);
    if (Number.parseFloat(rawHue) !== source.hue || chroma <= 0 || chroma > source.chroma) return match;

    count += 1;
    const scaled = (chroma / source.chroma) * target.chroma;
    // A zero-chroma colour has no meaningful hue; `0 0` matches how the
    // achromatic tokens in the sheet are already written.
    const components = scaled === 0 ? '0 0' : `${formatNumber(scaled)} ${formatNumber(target.hue)}`;
    return `oklch(${lightness} ${components}${alpha === undefined ? '' : ` / ${alpha}`})`;
  });
  return { css: out, count };
}

// ---------------------------------------------------------------------------
// Prose, so the generated sheet's own comments stay true
// ---------------------------------------------------------------------------

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Update the `--neutral-hue` / `--neutral-chroma` declarations and the comments
 * that name those numbers ("hue-270 tint", "hue 270, chroma 0.004"). The
 * declarations are documentation too — nothing resolves them at runtime, for the
 * reasons in this file's header — but leaving them stale would misdescribe the
 * sheet they sit in.
 */
function rewriteDocs(css, source, target) {
  const hue = formatNumber(target.hue);
  const chroma = formatNumber(target.chroma);
  return css
    .replace(NEUTRAL_HUE_RE, `--neutral-hue: ${hue};`)
    .replace(NEUTRAL_CHROMA_RE, `--neutral-chroma: ${chroma};`)
    .replace(new RegExp(`hue-${escapeRegex(source.rawHue)}(?![\\d.])`, 'g'), `hue-${hue}`)
    .replace(new RegExp(`hue ${escapeRegex(source.rawHue)}(?![\\d.])`, 'g'), `hue ${hue}`)
    .replace(new RegExp(`chroma ${escapeRegex(source.rawChroma)}(?![\\d.])`, 'g'), `chroma ${chroma}`)
    .replace('canonical @theme block', 'generated @theme block');
}

/** Point the sheet's own usage example at the generated file. */
function rewriteImportExample(css, outName) {
  return css.replace('@import "rn-motion-ui/tokens.css";', `@import "./${outName}";`);
}

function buildHeader(source, target, outName, version) {
  return `/*
 * GENERATED FILE — do not edit by hand.
 *
 * rn-motion-ui token sheet, retinted to hue ${formatNumber(target.hue)} / chroma ${formatNumber(target.chroma)}
 * (from hue ${source.rawHue} / chroma ${source.rawChroma}, rn-motion-ui@${version}).
 *
 * Regenerate with:
 *   npx rn-motion-ui-tokens --hue ${formatNumber(target.hue)} --chroma ${formatNumber(target.chroma)} --force
 *
 * Import this INSTEAD OF "rn-motion-ui/tokens.css" — it is a full replacement,
 * not an overlay:
 *
 *   @import "tailwindcss";
 *   @import "uniwind";
 *   @import "./${outName}";
 *
 * Every colour is spelled out as a literal oklch() rather than composed from
 * var(--neutral-hue) / var(--neutral-chroma): uniwind cannot fold a var() through
 * oklch() when it compiles the sheet for native, so the tint is applied here, at
 * generation time, instead of at runtime.
 *
 * Native note: className styling picks these values up on every platform, since
 * uniwind compiles this sheet into the native stylesheet. useThemeColor() and
 * useThemeColors() read the live custom properties on web, so they track this
 * file too — but on native they resolve against sRGB tables baked from the
 * library's own hue ${source.rawHue} / chroma ${source.rawChroma}. At neutral-tint chromas that difference is
 * invisible; if you retint to a vivid chroma, pass colours explicitly where a
 * hook value has to match a className on native.
 */

`;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/** `--hue 250` and `--hue=250` are both accepted. */
function parseArgs(argv) {
  const options = { hue: null, chroma: null, out: null, force: false, stdout: false, help: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--force' || arg === '-f') {
      options.force = true;
      continue;
    }
    if (arg === '--stdout') {
      options.stdout = true;
      continue;
    }

    const flag = /^--(hue|chroma|out)(?:=(.*))?$/.exec(arg);
    if (!flag) fail(`Unknown argument: ${arg}`);
    const [, name, inlineValue] = flag;
    const raw = inlineValue ?? argv[(i += 1)];
    if (raw === undefined || raw === '') fail(`--${name} needs a value.`);

    if (name === 'out') {
      options.out = raw;
      continue;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) fail(`--${name} expects a number, got "${raw}".`);
    options[name] = value;
  }

  return options;
}

/** Resolve the requested tint, falling back to the source sheet's own values. */
function resolveTarget(options, source) {
  const chroma = options.chroma ?? source.chroma;
  if (chroma < 0 || chroma > MAX_CHROMA) {
    fail(`--chroma must be between 0 and ${MAX_CHROMA} (OKLCH chroma; sRGB tops out near 0.37).`);
  }
  // Hue is cyclic, so -20 and 400 are both meaningful — normalise, don't reject.
  const hue = options.hue === null ? source.hue : ((options.hue % 360) + 360) % 360;
  return { hue, chroma };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(USAGE);
    return;
  }

  const sourceCss = readSource();
  const source = readNeutral(sourceCss);
  const target = resolveTarget(options, source);

  const outPath = resolve(process.cwd(), options.out ?? DEFAULT_OUT);
  const outName = basename(outPath);
  const { css, count } = retint(sourceCss, source, target);
  const output = buildHeader(source, target, outName, readVersion()) + rewriteImportExample(rewriteDocs(css, source, target), outName);

  if (options.stdout) {
    process.stdout.write(output);
    return;
  }

  if (existsSync(outPath) && !options.force) {
    fail(`${relative(process.cwd(), outPath) || outName} already exists. Pass --force to overwrite it.`);
  }

  writeFileSync(outPath, output);

  const rel = relative(process.cwd(), outPath) || outName;
  console.log(`✔  Wrote ${rel} — hue ${formatNumber(target.hue)}, chroma ${formatNumber(target.chroma)}`);
  console.log(`   ${count} tinted colour${count === 1 ? '' : 's'} rewritten; status colours keep their own hues.`);
  console.log('   Import it in your global CSS instead of "rn-motion-ui/tokens.css":');
  console.log(`     @import "./${outName}";`);
}

main();
