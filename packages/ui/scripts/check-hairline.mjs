#!/usr/bin/env node
/**
 * check-hairline.mjs — fails if any source file spells a border width outside
 * the `hairline` convention: every border is `hairline` / `hairline-t|r|b|l`
 * (2px), never a raw RN `borderWidth` style prop or an arbitrary `border-[Npx]`
 * class.
 *
 * Sanctioned exceptions:
 *  - `border-[3px]` — the selected RadioCard / CheckboxCard weight, a second
 *    width so selection reads stronger than the resting hairline.
 *  - `border-*-0` — ButtonGroup's per-side reset (`border-l-0` / `border-t-0`),
 *    which cancels one side of a hairline rather than drawing one.
 *
 * Usage: node scripts/check-hairline.mjs
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = new URL('.', import.meta.url).pathname;
const srcDir = resolve(__dirname, '../src');

// A raw RN `borderWidth` style prop — the `hairline` utility should be used.
const BORDER_WIDTH_RE = /borderWidth\s*:/;
// An arbitrary `border-[Npx]` class. `border-[3px]` is the sanctioned exception.
const ARBITRARY_BORDER_RE = /border-\[\d+(?:\.\d+)?px\]/;
const SELECTED_CARD_RE = /border-\[3px\]/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if ((extname(entry) === '.tsx' || extname(entry) === '.ts') &&
               !entry.endsWith('.stories.tsx') &&
               !full.includes('__tests__')) {
      out.push(full);
    }
  }
  return out;
}

let failures = 0;

for (const file of walk(srcDir)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (BORDER_WIDTH_RE.test(line)) {
      report(file, i + 1, line, 'raw `borderWidth` style prop — use the `hairline` utility');
    }
    // The arbitrary-border regex also matches `border-[3px]`, so test the
    // sanctioned exception first and only flag the rest.
    if (ARBITRARY_BORDER_RE.test(line) && !SELECTED_CARD_RE.test(line)) {
      report(file, i + 1, line, 'arbitrary border width — use `hairline` (or `border-[3px]` for the selected card)');
    }
  }
}

function report(file, lineNo, line, why) {
  const rel = relative(resolve(__dirname, '../..'), file);
  console.error(`  ${rel}:${lineNo}  ${line.trim()}\n    ${why}`);
  failures += 1;
}

if (failures > 0) {
  console.error(`\n✖  ${failures} border-width literal(s) found outside the hairline convention.`);
  console.error('   Use the `hairline` utility (2px), or `border-[3px]` for the selected card.\n');
  process.exit(1);
}

console.log('✔  No border widths outside the hairline convention in src.');
