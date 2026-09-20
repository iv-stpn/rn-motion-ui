#!/usr/bin/env node
/**
 * check-native-bundle.mjs — asserts a native bundle resolved every platform twin
 * through the package's exports map, and bundled the native file rather than its
 * web sibling.
 *
 * Usage:
 *   node scripts/check-native-bundle.mjs [sourcemap]
 *
 * Default sourcemap:
 *   storybook/native/android/app/build/generated/sourcemaps/react/release/index.android.bundle.map
 * (the path the React Native gradle plugin passes to `--sourcemap-output`; see
 * BundleHermesCTask.getBundleCommand)
 *
 * Why this exists
 * ---------------
 * A platform twin is only reachable through the exports map when a consumer
 * imports its subpath **by name** — `rn-motion-ui/toaster`, not `./toaster`.
 * Metro applies its `.native` platform substitution to the latter (an
 * extensionless relative specifier) but *not* to the former: the map has already
 * resolved to a concrete filename by the time Metro sees it, so a subpath that
 * has lost its `react-native` condition silently bundles the web twin. That is
 * how 7.10.1–7.11.1 shipped `./toaster` broken — a bare `<style>` element
 * reached Android and threw `View config getter callback for component \`style\`'
 * must be a function` on mount.
 *
 * Why a source map, and not the bundle
 * ------------------------------------
 * The release bundle carries no module paths: identifiers are mangled and
 * `__d(...)` registrations are positional, so there is nothing to grep for. The
 * source map gradle already emits alongside it names every module that went in,
 * which makes the resolution decision directly assertable.
 *
 * Why the probe
 * -------------
 * Every story in the app imports its twin relatively, so the storybook's bundle
 * exercises platform substitution and never the map — a guard over it alone
 * would have passed on the broken release. `storybook/native/native-twin-probe.ts`
 * closes that hole by importing each subpath by name; this script requires that
 * probe to be in the bundle, and fails if a twin-bearing subpath it does not
 * cover appears, so a new twin cannot go unprobed.
 *
 * Rules
 *  - The probe must be in the bundle.
 *  - Every subpath in the exports map whose file has a `.native` sibling on disk
 *    must have its native twin in the bundle.
 *  - …and its web twin must NOT be in the bundle.
 *
 * The expected twin is derived from disk, not from the map's `react-native`
 * condition: a map that has lost the condition is exactly the fault this guards
 * against, and reading the target out of the map would make that fault define
 * itself as correct. (check-exports.mjs rule 4d owns the map's shape; this owns
 * the bundle's contents.)
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..');
const repoRoot = resolve(pkgRoot, '..', '..');

/** The module that forces every twin-bearing subpath through the exports map. */
const PROBE_SOURCE = 'storybook/native/native-twin-probe.ts';
const PROBE_IMPORTER = 'storybook/native/index.ts';

const DEFAULT_SOURCEMAP = resolve(
  repoRoot,
  'storybook/native/android/app/build/generated/sourcemaps/react/release/index.android.bundle.map',
);

const sourceMapPath = process.argv.slice(2).find((arg) => !arg.startsWith('-'));

if (!sourceMapPath && !existsSync(DEFAULT_SOURCEMAP)) {
  console.error(`✖  No source map at the default path:\n     ${DEFAULT_SOURCEMAP}\n`);
  console.error('   Build the release bundle first (see .github/workflows/release.yml, the `apk`');
  console.error('   job), or pass a path explicitly.');
  process.exit(1);
}

const mapPath = resolve(sourceMapPath ?? DEFAULT_SOURCEMAP);
if (!existsSync(mapPath)) {
  console.error(`✖  No source map at ${mapPath}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. The modules that actually went into the bundle
// ---------------------------------------------------------------------------

let sources;
try {
  sources = JSON.parse(readFileSync(mapPath, 'utf8')).sources ?? [];
} catch (error) {
  console.error(`✖  Could not read the source map at ${mapPath}:\n     ${error.message}`);
  process.exit(1);
}

// Metro emits each source root-relative with a leading slash; the Hermes compose
// step can hand back a `sourceRoot` with the slash dropped. Normalize so the tail
// match below holds either way, and whatever the root turned out to be.
const normalized = sources.map((source) => {
  const slashed = source.replace(/\\/g, '/');
  return slashed.startsWith('/') ? slashed : `/${slashed}`;
});
const inBundle = (relPath) => normalized.some((source) => source.endsWith(`/${relPath}`));

// A map that names nothing under packages/ui/src is not the map this script was
// pointed at (a web build's, or a format whose `sources` are bare filenames), and
// every twin would report UNRESOLVED for the wrong reason. Say so directly.
if (normalized.length > 0 && !normalized.some((source) => source.includes('/packages/ui/src/'))) {
  console.error(`✖  ${mapPath} names no file under packages/ui/src.`);
  console.error('   This does not look like the source map of a storybook/native release bundle —');
  console.error(`   its ${normalized.length} sources start with, e.g., ${normalized[0]}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Every subpath whose file has a `.native` sibling on disk
// ---------------------------------------------------------------------------

/** `x/toaster.tsx` -> `x/toaster.native.tsx`; non-TS paths have no twin. */
function nativeTwin(relFromPkg) {
  if (!/\.tsx?$/.test(relFromPkg)) return null;
  return relFromPkg.replace(/\.tsx?$/, (ext) => `.native${ext}`);
}

const pkg = JSON.parse(readFileSync(resolve(pkgRoot, 'package.json'), 'utf8'));

/** @type {{subpath: string, web: string, native: string}[]} */
const twins = [];
for (const [subpath, entry] of Object.entries(pkg.exports ?? {})) {
  if (!entry || typeof entry !== 'object') continue;
  const web = entry.source ?? entry.default;
  if (!web) continue;
  const twin = nativeTwin(web);
  if (twin && existsSync(resolve(pkgRoot, twin))) {
    twins.push({ subpath, web: web.replace(/^\.\//, ''), native: twin.replace(/^\.\//, '') });
  }
}

// ---------------------------------------------------------------------------
// 3. Check
// ---------------------------------------------------------------------------

const problems = [];

if (twins.length === 0) {
  problems.push(
    'NO TWINS  the exports map declares no subpath whose file has a `.native` sibling — ' +
      'expected at least one (./toaster, ./surface, …). Did the map lose its react-native conditions?',
  );
}

if (!inBundle(PROBE_SOURCE)) {
  problems.push(
    `PROBE     ${PROBE_SOURCE} is not in the bundle, so the exports map was never exercised.\n` +
      `            Is it still imported from ${PROBE_IMPORTER}?`,
  );
} else {
  for (const { subpath, web, native } of twins) {
    if (!inBundle(native)) {
      problems.push(
        `UNRESOLVED  ${subpath} → the native twin ${native} never reached the bundle.\n` +
          `            Is ${subpath} imported by the probe? A twin-bearing subpath with no probe\n` +
          '            import is not covered by this guard.',
      );
    }
    if (inBundle(web)) {
      problems.push(
        `WRONG TWIN  ${subpath} → the WEB twin ${web} was bundled for a native build.\n` +
          `            Expected ${native}. Check the react-native condition on ${subpath}.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Report and exit
// ---------------------------------------------------------------------------

if (problems.length === 0) {
  console.log(`✔  native bundle OK — ${twins.length} platform twins resolved to their native file.`);
  for (const { subpath, native } of twins) console.log(`     ${subpath} → ${native}`);
  process.exit(0);
}

console.error(`✖  native bundle has ${problems.length} problem(s):\n`);
for (const problem of problems) console.error(`  ${problem}\n`);
process.exit(1);
