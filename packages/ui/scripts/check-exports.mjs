#!/usr/bin/env node
/**
 * check-exports.mjs — validates (and optionally rewrites) the exports map in
 * packages/ui/package.json.
 *
 * Usage:
 *   node scripts/check-exports.mjs          # validate only — exits 1 on errors
 *   node scripts/check-exports.mjs --write  # rewrite the exports block, then validate
 *
 * Rules:
 *  - Every declared export path must point at a file that exists on disk.
 *  - Every component/hook/moti/lib/utils source file (excl. stories + tests) must
 *    have a corresponding export entry.
 *  - Every derived entry must match the one generated from disk, and any declared
 *    entry whose file has a `.native` sibling must carry a `react-native` condition
 *    pointing at that sibling (see buildEntry).
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, basename, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..');
const pkgJsonPath = resolve(pkgRoot, 'package.json');
const srcDir = resolve(pkgRoot, 'src');

const WRITE = process.argv.includes('--write');

// ---------------------------------------------------------------------------
// 1. Collect all source files that should be exported
// ---------------------------------------------------------------------------

/** A file counts as an exportable source only if it is TypeScript and neither a story nor a test. */
function isExportableSourceFile(entry, full) {
  const isTypeScript = entry.endsWith('.ts') || entry.endsWith('.tsx');
  const isStory = entry.endsWith('.stories.ts') || entry.endsWith('.stories.tsx');
  const isTest = entry.endsWith('.test.ts') || entry.endsWith('.test.tsx') || full.includes('__tests__');
  return isTypeScript && !isStory && !isTest;
}

/** Recursively list all .ts / .tsx files, excluding stories and test files. */
function collectSourceFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectSourceFiles(full));
    } else if (isExportableSourceFile(entry, full)) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Derive the export subpath key for a given source file.
 *
 * Only returns a key for files that are EXPECTED to be part of the public API.
 * Internal implementation files return null — they are not auto-required to
 * appear in the exports map (though any that DO appear are still validated for
 * existence by the dangling check above).
 *
 * Public API rules:
 *   src/components/<Dir>/<file> -> ./<file-stem>
 *     BUT only when <file-stem> matches the kebab-cased <Dir> (the primary
 *     entry point). Non-primary files (table-parts, table-styles, …) may
 *     intentionally be exported too — they are validated via the dangling
 *     check — but are not auto-required.
 *   src/hooks/<file>            -> ./hooks/<file-stem>  (all hooks required)
 *   src/lib/ease.ts             -> ./ease
 *   src/lib/icons.tsx           -> ./icons
 *   src/utils/<file>            -> ./utils/<file-stem>
 *   src/theme/                  -> skipped (CSS + TS handled separately)
 *   src/moti/                   -> skipped (hand-curated in package.json)
 *   src/lib/cn.ts               -> skipped (internal utility, not public API)
 */
function deriveExportKey(absPath) {
  const rel = relative(srcDir, absPath).replace(/\\/g, '/');
  const stem = basename(rel, extname(rel));

  if (rel.startsWith('hooks/')) return `./hooks/${stem}`;
  if (rel.startsWith('utils/')) return `./utils/${stem}`;
  if (rel === 'lib/ease.ts') return './ease';
  if (rel === 'lib/icons.tsx') return './icons';

  if (rel.startsWith('components/')) {
    // Only the primary file per component folder is auto-required.
    // Primary = stem matches the kebab-case of the immediate parent directory.
    // Paths come in two shapes:
    //   3-segment: components/<Dir>/<file>        (e.g. components/icon/themed-icon.tsx)
    //   4-segment: components/<category>/<Dir>/<file> (e.g. components/display/Card/card.tsx)
    const parts = rel.split('/');
    let dirName = null;
    if (parts.length === 3) {
      dirName = parts[1];
    } else if (parts.length === 4) {
      dirName = parts[2];
    }
    if (dirName) {
      const dirKebab = dirName.replace(/([A-Z])/g, (m, c, i) => (i > 0 ? '-' : '') + c.toLowerCase());
      if (stem === dirKebab) return `./${stem}`;
    }
    return null; // non-primary component file — validated by dangling check only
  }

  return null;
}

/**
 * The `.native` sibling of a TypeScript path: `./src/a/b.tsx` →
 * `./src/a/b.native.tsx`. Returns null when the path is not TypeScript.
 *
 * Metro does NOT apply `.native` platform-extension substitution to a path the
 * exports map has already resolved to an explicit filename, so a twin only
 * routes by platform via an explicit `react-native` condition on its entry.
 */
function nativeTwin(relFromPkg) {
  if (!/\.tsx?$/.test(relFromPkg)) return null;
  return relFromPkg.replace(/\.tsx?$/, (ext) => `.native${ext}`);
}

/**
 * Build the export entry for a source file. The convention is source == types ==
 * default, plus a `react-native` condition when the file has a `.native` twin on
 * disk (which routes ./surface and ./toaster between their two implementations).
 *
 * The twin is *derived*, never listed. A hand-maintained list of twins is blind
 * to the twins it does not name, so `--write` rewrites those entries without the
 * condition and silently strips it — which is exactly how ./toaster lost its
 * native toast (a Reanimated toast on native, a Sonner adapter on web) while
 * still shipping toaster.native.tsx, leaving every native consumer bundling the
 * web twin's `<style>` element and crashing on mount.
 */
function buildEntry(relFromPkg) {
  const entry = {
    source: relFromPkg,
    types: relFromPkg,
    default: relFromPkg,
  };
  const twin = nativeTwin(relFromPkg);
  if (twin && existsSync(resolve(pkgRoot, twin))) {
    return { 'react-native': twin, ...entry };
  }
  return entry;
}

/** Field order is not significant — compare two entries as plain mappings. */
function sameEntry(a, b) {
  const fieldsA = Object.keys(a).sort();
  const fieldsB = Object.keys(b).sort();
  if (fieldsA.length !== fieldsB.length) return false;
  return fieldsA.every((field, i) => field === fieldsB[i] && a[field] === b[field]);
}

/** One-line rendering of an entry, for the DRIFTED report. */
function formatEntry(entry) {
  const body = Object.entries(entry)
    .map(([field, value]) => `${field}: ${value}`)
    .join(', ');
  return `{ ${body} }`;
}

// ---------------------------------------------------------------------------
// 2. Read the existing package.json
// ---------------------------------------------------------------------------

const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
const existingExports = pkg.exports ?? {};

// ---------------------------------------------------------------------------
// 3. Build the expected exports map from disk
// ---------------------------------------------------------------------------

const sourceFiles = collectSourceFiles(srcDir);

// key → expected entry (generated from disk)
const expectedEntries = new Map();

// Static CSS export — always expected after Phase 2
const tokensCssAbs = resolve(srcDir, 'theme/tokens.css');
if (existsSync(tokensCssAbs)) {
  expectedEntries.set('./tokens.css', { default: './src/theme/tokens.css' });
}

for (const abs of sourceFiles) {
  const key = deriveExportKey(abs);
  if (!key) continue;
  const relFromPkg = `./${relative(pkgRoot, abs).replace(/\\/g, '/')}`;
  // Only add to expected map if there isn't already a platform variant already
  // mapped (hoverable.native.tsx is referenced by the hoverable.tsx entry).
  if (abs.endsWith('.native.tsx') || abs.endsWith('.native.ts')) continue;
  expectedEntries.set(key, buildEntry(relFromPkg));
}

// ---------------------------------------------------------------------------
// 4. Compare
// ---------------------------------------------------------------------------

/**
 * Every rule, run against a whole exports map. Both the validate path and the
 * post-`--write` gate call this, so the two cannot drift apart: a rule --write
 * cannot satisfy (a hand-curated entry, which it never rewrites) fails the
 * write path too, instead of being silently reported as fixed.
 */
function validateExports(exportsMap) {
  const problems = [];

  for (const [key, entry] of Object.entries(exportsMap)) {
    if (key === './tokens.css') continue; // CSS export checked separately
    if (key === './package.json') continue; // bare self-reference, not a TS source file

    // 4a. Dangling: declared in package.json but file doesn't exist
    for (const field of ['source', 'types', 'default', 'react-native']) {
      const val = entry[field];
      if (!val) continue;
      const abs = resolve(pkgRoot, val);
      if (!existsSync(abs)) {
        problems.push(`DANGLING  ${key} → ${val}  (file not found)`);
      }
    }

    // 4d. Twin unbound: an entry whose file has a `.native` sibling must carry a
    // react-native condition pointing at it, or Metro bundles the default/web
    // file on native — the ./toaster regression. 4c only reaches the keys the
    // script derives, so this is what guards the hand-curated twins
    // (./moti/hover, ./overlay/*) that --write never rewrites.
    const base = entry.source ?? entry.default;
    const twin = base ? nativeTwin(base) : null;
    if (twin && existsSync(resolve(pkgRoot, twin)) && entry['react-native'] !== twin) {
      const found = entry['react-native'] ?? '(no react-native condition)';
      problems.push(`TWIN      ${key} → ${found}  (expected ${twin})`);
    }
  }

  for (const [key, expected] of expectedEntries) {
    // 4b. Missing: source file exists but no export declared
    if (!(key in exportsMap)) {
      problems.push(`MISSING   ${key}  (no entry in package.json exports)`);
      continue;
    }

    // 4c. Drifted: the key is present but its entry is no longer the one the
    // generator derives. 4b only checks that the key exists, so a field stripped
    // from a present entry passes it silently — also the ./toaster regression.
    const actual = exportsMap[key];
    if (!sameEntry(actual, expected)) {
      problems.push(
        `DRIFTED   ${key}\n` +
          `            expected  ${formatEntry(expected)}\n` +
          `            found     ${formatEntry(actual)}    (run with --write to regenerate)`,
      );
    }
  }

  return problems;
}

const errors = validateExports(existingExports);

// ---------------------------------------------------------------------------
// 5. --write: regenerate the exports block
// ---------------------------------------------------------------------------

if (WRITE) {
  // Merge, never replace. `expectedEntries` only holds the auto-required subset
  // (primary component files, hooks, ease, icons) — the map also carries
  // hand-curated keys the derivation rules deliberately skip: ./package.json,
  // ./moti/*, ./theme/*, ./overlay/*, the non-primary ./table-* helpers and the
  // ./lib re-exports. Regenerating from `expectedEntries` alone would silently
  // delete every one of them (and break consumers importing them), so existing
  // keys are kept and only missing ones are added.
  // Existing keys keep their current position (the map is grouped by hand —
  // overlay/theme up top, the moti layer last); only the missing ones are
  // appended, sorted, so the diff is just the new lines.
  //
  // For the keys the script derives from disk, disk is the source of truth, so
  // an existing entry is *rewritten* — that repairs a path left dangling by a
  // renamed file (a .ts that became .tsx, say) and re-derives the react-native
  // condition from the twin on disk. Keys it does not derive — ./moti/*,
  // ./theme/*, ./overlay/*, the ./table-* helpers, ./package.json — are never
  // touched, which is what stops --write from wiping them.
  const merged = new Map(Object.entries(existingExports));
  const added = [...expectedEntries.keys()].filter((key) => !merged.has(key)).sort();
  for (const [key, entry] of expectedEntries) {
    if (merged.has(key)) merged.set(key, entry);
  }
  for (const key of added) merged.set(key, expectedEntries.get(key));

  const newExports = Object.fromEntries(merged);
  pkg.exports = newExports;
  writeFileSync(pkgJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`✔  Wrote exports map (${merged.size} entries, ${added.length} added).`);

  // The same rules, over what was just written: --write settles every derived
  // entry, so anything left is a hand-curated one it never touches and cannot
  // fix. Failing here is what stops the pre-commit hook from staging a
  // half-repaired map and calling it fixed.
  const postErrors = validateExports(newExports);
  if (postErrors.length) {
    console.error('\nErrors after rewrite:');
    for (const e of postErrors) console.error(`  ${e}`);
    process.exit(1);
  }
  console.log('✔  All generated exports resolve correctly.');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 6. Report and exit
// ---------------------------------------------------------------------------

if (errors.length === 0) {
  const count = Object.keys(existingExports).length;
  console.log(`✔  exports map OK — ${count} entries, all resolve correctly.`);
  process.exit(0);
} else {
  console.error(`✖  exports map has ${errors.length} error(s):\n`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
