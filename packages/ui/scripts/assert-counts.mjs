#!/usr/bin/env node
/**
 * assert-counts.mjs — verifies that the story-file count in README.md matches
 * the actual number of .stories.tsx files under packages/ui/src/.
 *
 * Usage:
 *   node scripts/assert-counts.mjs        # exits 1 if README is stale
 *   node scripts/assert-counts.mjs --fix  # updates the README count in place
 *
 * Add to CI / pre-push to prevent the count from drifting again.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..');
const repoRoot = resolve(pkgRoot, '../..');
const readmePath = resolve(repoRoot, 'README.md');
const srcDir = resolve(pkgRoot, 'src');

const FIX = process.argv.includes('--fix');

/** Recursively count files that match `predicate`. */
function countFiles(dir, predicate) {
  let count = 0;
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) {
      count += countFiles(full, predicate);
    } else if (predicate(entry)) {
      count++;
    }
  }
  return count;
}

const storyCount = countFiles(srcDir, (f) => f.endsWith('.stories.tsx'));
const readme = readFileSync(readmePath, 'utf8');

const storyRe = /(\d+) story files/;
const match = readme.match(storyRe);
if (!match) {
  console.error('✖  README.md does not contain the expected "N story files" phrase.');
  process.exit(1);
}

const readmeCount = Number(match[1]);

if (storyCount === readmeCount) {
  console.log(`✔  Story count OK — ${storyCount} story files.`);
  process.exit(0);
}

if (FIX) {
  const updated = readme.replace(storyRe, `${storyCount} story files`);
  writeFileSync(readmePath, updated);
  console.log(`✔  Updated README.md: ${readmeCount} → ${storyCount} story files.`);
  process.exit(0);
}

console.error(`✖  Story count mismatch: README says ${readmeCount}, disk has ${storyCount}.`);
console.error('   Run with --fix to update README.md automatically.');
process.exit(1);
