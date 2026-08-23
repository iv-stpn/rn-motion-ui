#!/usr/bin/env node
/**
 * check-readme.mjs — keeps the root README.md in sync with what the package
 * actually ships. Everything it checks is derived from two machine-readable
 * sources: the `exports` map in packages/ui/package.json, and the story files
 * on disk.
 *
 * It replaces the older assert-counts.mjs, which only guarded the story-file
 * number — the component and hook lists drifted anyway (four shipped components
 * and two hooks went unlisted) because nothing generated them.
 *
 * What it does:
 *  - Generates the component / hook / table-helper / utility / internal lists
 *    into the `<!-- generated:NAME -->` blocks in README.md.
 *  - Generates the story-file and story counts.
 *  - Verifies every remaining exports subpath (the hand-grouped moti layer,
 *    tokens.css) is mentioned somewhere in the README, so a new subpath can't
 *    ship undocumented.
 *
 * Usage:
 *   node scripts/check-readme.mjs        # exits 1 if README is stale
 *   node scripts/check-readme.mjs --fix  # rewrites generated blocks AND inserts
 *                                        # missing rows into packages/ui/README.md
 *
 * Wired into .github/workflows/check.yml so the lists can't drift again.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..');
const repoRoot = resolve(pkgRoot, '../..');
const readmePath = resolve(repoRoot, 'README.md');
const pkgReadmePath = resolve(pkgRoot, 'README.md');
const pkgJsonPath = resolve(pkgRoot, 'package.json');
const srcDir = resolve(pkgRoot, 'src');

const FIX = process.argv.includes('--fix');

// ---------------------------------------------------------------------------
// 1. Read the exports map and sort every subpath into a README section
// ---------------------------------------------------------------------------

/**
 * Which generated block a subpath belongs in, keyed off the source file it
 * points at. Returns null for anything the rules don't cover — that's reported
 * rather than silently dropped, which is how the lists drifted before.
 *
 *   src/hooks/                       -> hooks
 *   src/lib/, src/theme/, src/utils/ -> utilities
 *   .../Overlay/                     -> internal (infra behind the sheet family)
 *   .../Table/ (helper)              -> table
 *   src/components/                  -> components
 */
function sectionFor(key, source) {
  if (source.startsWith('./src/hooks/')) return 'hooks';
  if (source.startsWith('./src/lib/') || source.startsWith('./src/theme/') || source.startsWith('./src/utils/'))
    return 'utilities';
  if (!source.startsWith('./src/components/')) return null;
  // Match on the folder holding the file rather than the path from src/, so the
  // depth between components/ and the component folder doesn't matter. Anchoring
  // on the full path is exactly how Overlay and Table landed in the component
  // list once the category folders (menus/, display/, …) came between them.
  const componentDir = source.split('/').at(-2);
  if (componentDir === 'Overlay') return 'internal';
  // `./table` is the component; every other Table file is a helper around it.
  if (componentDir === 'Table') return key === './table' ? 'components' : 'table';
  return 'components';
}

/**
 * Read a component source file and extract every PascalCase name exported with
 * `export function` or `export const` — those are the symbols the README table
 * should document. Returns an empty array when the file can't be read (binary,
 * missing) or when there are no matches (the subpath re-exports from elsewhere).
 */
function extractExports(sourcePath) {
  const fullPath = resolve(pkgRoot, sourcePath.replace(/^\.\//, ''));
  let content;
  try {
    content = readFileSync(fullPath, 'utf8');
  } catch {
    return [];
  }
  const names = [];
  const re = /^export (?:function|const) ([A-Z]\w*)/gm;
  let match;
  while ((match = re.exec(content)) !== null) {
    names.push(match[1]);
  }
  return names;
}

// Subpaths that live in hand-written prose rather than a generated list. The
// moti layer is grouped by role (primitives / presence / pressable / core), a
// shape no flat alphabetical list would keep, so it is checked for mention
// instead of generated.
const isMentionOnly = (key) => key.startsWith('./moti/') || key === './tokens.css';

const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
const sections = { components: [], hooks: [], table: [], utilities: [], internal: [] };
const mentionOnly = [];
const unclassified = [];

for (const [key, entry] of Object.entries(pkg.exports)) {
  if (key === './package.json') continue;
  if (isMentionOnly(key)) {
    mentionOnly.push(key);
    continue;
  }
  const source = typeof entry === 'string' ? entry : (entry.source ?? entry.default);
  const section = sectionFor(key, source);
  if (section === null) {
    unclassified.push(key);
    continue;
  }
  sections[section].push(key.replace(/^\.\//, ''));
}

for (const names of Object.values(sections)) names.sort();

// ---------------------------------------------------------------------------
// 2. Count story files and stories
// ---------------------------------------------------------------------------

/** Recursively list files matching `predicate`. */
function collectFiles(dir, predicate) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) results.push(...collectFiles(full, predicate));
    else if (predicate(entry)) results.push(full);
  }
  return results;
}

const storyFiles = collectFiles(srcDir, (f) => f.endsWith('.stories.tsx'));
// Storybook turns every named export of a story file into one story, and
// @storybook/addon-vitest turns every story into one vitest test — so this
// count is exactly what `bun run test:storybook` reports.
const storyCount = storyFiles.reduce(
  (total, file) => total + (readFileSync(file, 'utf8').match(/^export const \w+/gm)?.length ?? 0),
  0,
);

// ---------------------------------------------------------------------------
// 3. Build the expected content of each generated block
// ---------------------------------------------------------------------------

const list = (names) => names.map((name) => `\`${name}\``).join(' · ');

const blocks = {
  components: list(sections.components),
  hooks: list(sections.hooks),
  table: list(sections.table),
  utilities: list(sections.utilities),
  internal: list(sections.internal),
  counts: `${storyFiles.length} story files, ${storyCount} stories.`,
};

// ---------------------------------------------------------------------------
// 4. Compare (or rewrite)
// ---------------------------------------------------------------------------

const readme = readFileSync(readmePath, 'utf8');
const errors = [];
let updated = readme;

for (const [name, expected] of Object.entries(blocks)) {
  const open = `<!-- generated:${name} -->`;
  const close = `<!-- /generated:${name} -->`;
  // Whole block, non-greedy — matched and rebuilt as a unit rather than patched
  // in place, so an empty block (a marker pair with nothing between it, how a
  // new section starts life) is handled like any other.
  const re = new RegExp(`${open}\\n?([\\s\\S]*?)\\n?${close}`);
  const match = updated.match(re);
  if (match === null) {
    errors.push(`MISSING BLOCK  ${open} … ${close} not found in README.md`);
    continue;
  }
  if (match[1] === expected) continue;
  if (FIX) updated = updated.replace(re, `${open}\n${expected}\n${close}`);
  else errors.push(`STALE BLOCK    generated:${name}\n    expected: ${expected}\n    found:    ${match[1]}`);
}

// Every subpath that isn't generated must at least be named in the prose.
for (const key of mentionOnly) {
  const name = key.replace(/^\.\//, '');
  if (!updated.includes(name)) errors.push(`UNDOCUMENTED   ${key} is exported but never mentioned in README.md`);
}
for (const key of unclassified) {
  errors.push(`UNCLASSIFIED   ${key} fits no README section — extend sectionFor() in this script`);
}

// The published README (packages/ui/README.md) carries its own "UI components"
// table — subpath alongside the symbols it exports. The symbol column was
// hand-written, but when --fix is passed the script now reads each missing
// component's source, extracts PascalCase exports, and inserts a row in
// alphabetical order. Scoped to components on purpose: hooks, the moti layer and
// utils are documented there as namespaced categories rather than row by row.
const pkgReadme = readFileSync(pkgReadmePath, 'utf8');
const missingFromPkgReadme = [];
for (const name of [...sections.components, ...sections.table]) {
  if (!pkgReadme.includes(`\`/${name}\``)) missingFromPkgReadme.push(name);
}

if (missingFromPkgReadme.length > 0 && FIX) {
  // Build rows for every missing subpath, extracting symbols from source.
  const newRows = [];
  for (const name of missingFromPkgReadme) {
    const entry = pkg.exports[`./${name}`];
    const source = typeof entry === 'string' ? entry : (entry.source ?? entry.default);
    const symbols = extractExports(source);
    const symbolStr =
      symbols.length > 0 ? symbols.map((s) => `\`${s}\``).join(', ') : '<!-- TODO: fill in symbols -->';
    newRows.push({ name, row: `| \`/${name}\` | ${symbolStr} |` });
  }

  // Find the table bracketed by the header row and the first non-row line after it.
  // The formatter pads the columns, so `| Subpath | Component / hook |` no longer
  // matches the aligned header — match the labels instead of a fixed-width string.
  const headerIdx = pkgReadme.search(/^[ \t]*\|[ \t]*Subpath[ \t]*\|[ \t]*Component \/ hook[ \t]*\|/m);
  if (headerIdx === -1) {
    for (const { name } of newRows) {
      errors.push(`UNPUBLISHED    ./${name} is exported but missing from the UI components table in packages/ui/README.md (table header not found)`);
    }
  } else {
    // Parse every existing row: { name, start, end }.
    const existing = [];
    let pos = pkgReadme.indexOf('\n', pkgReadme.indexOf('\n', headerIdx) + 1) + 1; // skip header + sep
    while (pos < pkgReadme.length) {
      const lineEnd = pkgReadme.indexOf('\n', pos);
      const line = pkgReadme.slice(pos, lineEnd === -1 ? pkgReadme.length : lineEnd);
      const m = line.match(/^\| `\/([^`]+)`[ \t]*\|/);
      if (!m) break;
      existing.push({ name: m[1], start: pos, end: lineEnd === -1 ? pkgReadme.length : lineEnd + 1 });
      if (lineEnd === -1) break;
      pos = lineEnd + 1;
    }

    // Insert in reverse-alphabetical order so earlier positions stay valid.
    let updatedPkgReadme = pkgReadme;
    const sorted = [...newRows].sort((a, b) => b.name.localeCompare(a.name));
    for (const { name, row } of sorted) {
      // Find the row this goes before (first existing with name > ours).
      const before = existing.find((r) => r.name > name);
      const insertPos = before ? before.start : existing[existing.length - 1].end;
      updatedPkgReadme = updatedPkgReadme.slice(0, insertPos) + row + '\n' + updatedPkgReadme.slice(insertPos);
    }
    writeFileSync(pkgReadmePath, updatedPkgReadme);
    console.log(`✔  Inserted ${sorted.length} row(s) into packages/ui/README.md.`);

    // Verify the fix actually worked — re-check each one.
    const fixedReadme = readFileSync(pkgReadmePath, 'utf8');
    for (const { name } of newRows) {
      if (!fixedReadme.includes(`\`/${name}\``)) {
        errors.push(`UNPUBLISHED    ./${name} fix was applied but the row is still not found in packages/ui/README.md`);
      }
    }
  }
} else {
  for (const name of missingFromPkgReadme) {
    errors.push(`UNPUBLISHED    ./${name} is exported but missing from the UI components table in packages/ui/README.md`);
  }
}

if (FIX && updated !== readme) {
  writeFileSync(readmePath, updated);
  console.log('✔  Updated README.md generated blocks.');
}

if (errors.length > 0) {
  console.error(`✖  README.md is out of sync (${errors.length} problem(s)):\n`);
  for (const e of errors) console.error(`  ${e}`);
  console.error('\n   Run `node packages/ui/scripts/check-readme.mjs --fix` to regenerate the lists.');
  process.exit(1);
}

const documented = Object.values(sections).reduce((sum, names) => sum + names.length, 0) + mentionOnly.length;
console.log(`✔  README OK — ${documented} subpaths documented, ${storyFiles.length} story files, ${storyCount} stories.`);
