#!/usr/bin/env node
/**
 * check-withRepeat.mjs — fails if any source file starts an *infinite* Reanimated
 * `withRepeat` loop on a shared value without cancelling it on teardown.
 *
 * An unbounded loop — `withRepeat(…, -1, …)` — is owned by the shared value it is
 * assigned to, so React unmounting the owning component does not stop it: it runs
 * forever and re-invokes the worklet every frame. The canonical fix is a
 * `useEffect` cleanup that calls `cancelAnimation(sharedValue)`. (This was the
 * root cause of a past 15-second Storybook stall.)
 *
 * Two subtleties:
 *  - Only a literal `-1` repeat count is unbounded. A finite count (`withRepeat(…,
 *    3, …)`) terminates on its own and needs no cleanup, so it is not flagged.
 *  - The moti apply layer (`moti/core/worklets/apply-{animation,style-key}`)
 *    composes a caller-supplied animation with `withRepeat(…, repeatCount, …)`,
 *    where the count is a *variable*, not a literal `-1` — so it is not flagged.
 *
 * Usage: node scripts/check-withRepeat.mjs
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = new URL('.', import.meta.url).pathname;
const srcDir = resolve(__dirname, '../src');

// `withRepeat(` … `, -1` followed by `,` or `)` — an unbounded loop. `[^;\n]*`
// stays on the line but still spans the nested `withTiming(...)` parens, so a
// one-line `withRepeat(withTiming(…), -1, false)` matches.
const INFINITE_REPEAT_RE = /\bwithRepeat\([^;\n]*,\s*-1\s*[,)]/;

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
  const source = readFileSync(file, 'utf8');
  if (!INFINITE_REPEAT_RE.test(source)) continue;
  // A cancelled loop is fine — the cleanup returns it on unmount.
  if (/\bcancelAnimation\b/.test(source)) continue;

  const rel = relative(resolve(__dirname, '../..'), file);
  console.error(`  ${rel}  starts an infinite withRepeat loop with no cancelAnimation cleanup`);
  failures += 1;
}

if (failures > 0) {
  console.error(`\n✖  ${failures} file(s) leak an infinite withRepeat loop.`);
  console.error('   Clean up with `return () => cancelAnimation(sharedValue)` in the starting effect.\n');
  process.exit(1);
}

console.log('✔  No un-cancelled infinite withRepeat loops in src.');
