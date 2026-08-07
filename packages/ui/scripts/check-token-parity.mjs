#!/usr/bin/env node
/**
 * check-token-parity.mjs — keeps the three declarations of every colour token
 * in agreement.
 *
 * A token value is written down three times:
 *   1. tokens.css `@theme`         — the light values, which register the token
 *      with Tailwind (so `bg-surface-3` exists) and are the web `:root` base
 *   2. tokens.css `@variant light` / `@variant dark` — the per-theme values.
 *      These are what uniwind compiles into its scoped theme buckets: it fills
 *      `scopedVars['__uniwind-theme-<theme>']` only from selectors carrying
 *      `:where(.light|.dark, …)`, which is what `@variant` expands to. A value
 *      that lives only in `@theme` is theme-independent by construction.
 *   3. use-theme-color.ts LIGHT_OKLCH / DARK_OKLCH — the native tables, which
 *      are also the web SSR fallback
 *
 * Nothing at runtime reconciles them, so a value edited in one place and missed
 * in another simply renders differently per platform or per theme-switch
 * mechanism. This script fails when that happens.
 *
 * Usage: node scripts/check-token-parity.mjs
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = new URL('.', import.meta.url).pathname;
const css = readFileSync(resolve(dir, '../src/theme/tokens.css'), 'utf8');
const ts = readFileSync(resolve(dir, '../src/theme/use-theme-color.ts'), 'utf8');

/** Slice out the region between an opening anchor and its matching brace depth. */
function block(source, anchor) {
  const start = source.indexOf(anchor);
  if (start === -1) throw new Error(`anchor not found: ${JSON.stringify(anchor)}`);
  let depth = 0;
  for (let i = start + anchor.length - 1; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i);
    }
  }
  throw new Error(`unterminated block: ${JSON.stringify(anchor)}`);
}

const DECL_RE = /--color-([a-z0-9-]+):\s*([^;]+);/g;

/** `--color-x: <value>` pairs in a CSS block, normalised for comparison. */
function cssTokens(source) {
  const out = new Map();
  for (const [, token, raw] of source.matchAll(DECL_RE)) out.set(token, raw.trim().replace(/\s+/g, ' '));
  return out;
}

const OKLCH_RE = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)$/;

/** Parse a css `oklch(…)` literal to the [L, C, H, alpha?] shape the TS tables use. */
function parseCssOklch(value) {
  const m = OKLCH_RE.exec(value);
  if (m === null) return null;
  const lightness = m[2] === '%' ? Number(m[1]) / 100 : Number(m[1]);
  const tuple = [lightness, Number(m[3]), Number(m[4])];
  if (m[5] !== undefined) tuple.push(Number(m[5]));
  return tuple;
}

const TABLE_RE = /'?([a-z0-9-]+)'?:\s*\[([^\]]+)\]/g;

/** `token: [L, C, H, a?]` entries from a LIGHT_OKLCH / DARK_OKLCH literal. */
function tsTable(name) {
  const source = block(ts, `const ${name}: Record<ThemeToken, Oklch> = {`);
  const out = new Map();
  for (const [, token, body] of source.matchAll(TABLE_RE)) out.set(token, body.split(',').map((n) => Number(n.trim())));
  return out;
}

const problems = [];

// Anchored to a line start: the file's doc comment shows example `@variant`
// blocks, which a bare substring search would find first.
const themeLight = cssTokens(block(css, '\n@theme {'));
const variantLight = cssTokens(block(css, '\n@variant light {'));
const variantDark = cssTokens(block(css, '\n@variant dark {'));

// ── @theme and @variant light must agree ────────────────────────────────────
// Both hold the light values. @theme registers the token with Tailwind and is
// the web `:root` base; @variant light is what uniwind reads into its scoped
// light bucket. A token edited in one and missed in the other renders one value
// on web at :root and a different one once the theme resolves.
for (const [token, value] of themeLight) {
  if (!variantLight.has(token))
    problems.push(`@variant light is missing --color-${token} (present in @theme)`);
  else if (variantLight.get(token) !== value)
    problems.push(`--color-${token}: @theme has "${value}", @variant light has "${variantLight.get(token)}"`);
}
for (const token of variantLight.keys())
  if (!themeLight.has(token)) problems.push(`@theme is missing --color-${token} (present in @variant light)`);

// ── both variants must declare the same token set ───────────────────────────
// uniwind's own gate: generateCSSForThemes errors per missing variable when the
// themes disagree, and it only logs, so a mismatch is bundle noise rather than
// a failed build. Fail here instead.
for (const token of variantLight.keys())
  if (!variantDark.has(token)) problems.push(`@variant dark is missing --color-${token} (present in @variant light)`);
for (const token of variantDark.keys())
  if (!variantLight.has(token)) problems.push(`@variant light is missing --color-${token} (present in @variant dark)`);

// ── the native tables must match their CSS counterparts ─────────────────────
const EPSILON = 0.0005;

function compare(scheme, cssMap, table) {
  for (const [token, tuple] of table) {
    const raw = cssMap.get(token);
    if (raw === undefined) {
      problems.push(`${scheme}: ${token} is in the native table but has no --color-${token} in tokens.css`);
      continue;
    }
    const parsed = parseCssOklch(raw);
    // Non-oklch literals (none today) can't be compared numerically; flag rather
    // than silently pass, so a future `rgb()` value doesn't slip the net.
    if (parsed === null) {
      problems.push(`${scheme}: --color-${token} is "${raw}", which this check can't parse as oklch()`);
      continue;
    }
    const same =
      parsed.length === tuple.length && parsed.every((n, i) => Math.abs(n - tuple[i]) < EPSILON);
    if (!same) problems.push(`${scheme}: --color-${token} is [${parsed}] in tokens.css but [${tuple}] in the native table`);
  }
  for (const token of cssMap.keys())
    if (!table.has(token)) problems.push(`${scheme}: --color-${token} has no entry in the native table`);
}

compare('light', variantLight, tsTable('LIGHT_OKLCH'));
compare('dark', variantDark, tsTable('DARK_OKLCH'));

if (problems.length > 0) {
  console.error('✖  Colour token declarations are out of sync:\n');
  for (const p of problems) console.error(`   ${p}`);
  console.error('\n   tokens.css (@theme / @variant light / @variant dark) and');
  console.error('   use-theme-color.ts (LIGHT_OKLCH / DARK_OKLCH) must all agree.\n');
  process.exit(1);
}

console.log('✔  Colour tokens agree across tokens.css and the native OKLCH tables.');
