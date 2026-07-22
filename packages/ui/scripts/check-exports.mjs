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

/** Recursively list all .ts / .tsx files, excluding stories and test files. */
function collectSourceFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectSourceFiles(full));
    } else if (
      (entry.endsWith('.ts') || entry.endsWith('.tsx')) &&
      !entry.endsWith('.stories.tsx') &&
      !entry.endsWith('.stories.ts') &&
      !entry.endsWith('.test.ts') &&
      !entry.endsWith('.test.tsx') &&
      !full.includes('__tests__')
    ) {
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
    const parts = rel.split('/');
    // parts: ['components', 'Button', 'button.tsx'] → dir='Button', stem='button'
    if (parts.length === 3) {
      const dirKebab = parts[1].replace(/([A-Z])/g, (m, c, i) => (i > 0 ? '-' : '') + c.toLowerCase());
      if (stem === dirKebab) return `./${stem}`;
    }
    return null; // non-primary component file — validated by dangling check only
  }

  return null;
}

/**
 * Build the three-field export entry (or four-field for ./moti/hover).
 * The convention is source == types == default; the one exception for the
 * react-native platform override is special-cased below.
 */
function buildEntry(relFromPkg) {
  const entry = {
    source: relFromPkg,
    types: relFromPkg,
    default: relFromPkg,
  };
  // Special case: moti/hover has a react-native platform override.
  if (relFromPkg.includes('/pressable/hoverable.tsx')) {
    return {
      'react-native': relFromPkg.replace('hoverable.tsx', 'hoverable.native.tsx'),
      ...entry,
    };
  }
  return entry;
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

const errors = [];

// 4a. Dangling: declared in package.json but file doesn't exist
for (const [key, entry] of Object.entries(existingExports)) {
  if (key === './tokens.css') continue; // CSS export checked separately
  if (key === './package.json') continue; // bare self-reference, not a TS source file
  for (const field of ['source', 'types', 'default', 'react-native']) {
    const val = entry[field];
    if (!val) continue;
    const abs = resolve(pkgRoot, val);
    if (!existsSync(abs)) {
      errors.push(`DANGLING  ${key} → ${val}  (file not found)`);
    }
  }
}

// 4b. Missing: source file exists but no export declared
for (const [key] of expectedEntries) {
  if (!(key in existingExports)) {
    errors.push(`MISSING   ${key}  (no entry in package.json exports)`);
  }
}

// ---------------------------------------------------------------------------
// 5. --write: regenerate the exports block
// ---------------------------------------------------------------------------

if (WRITE) {
  // Sort keys: tokens.css first, then alphabetically
  const sortedEntries = [...expectedEntries.entries()].sort(([a], [b]) => {
    if (a === './tokens.css') return -1;
    if (b === './tokens.css') return 1;
    return a.localeCompare(b);
  });

  const newExports = Object.fromEntries(sortedEntries);
  pkg.exports = newExports;
  writeFileSync(pkgJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`✔  Rewrote exports map (${sortedEntries.length} entries).`);

  // Re-validate after writing
  const postErrors = [];
  for (const [key, entry] of Object.entries(newExports)) {
    if (key === './tokens.css') continue;
    if (key === './package.json') continue;
    for (const field of ['source', 'types', 'default', 'react-native']) {
      const val = entry[field];
      if (!val) continue;
      const abs = resolve(pkgRoot, val);
      if (!existsSync(abs)) {
        postErrors.push(`DANGLING  ${key} → ${val}  (file not found)`);
      }
    }
  }
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
