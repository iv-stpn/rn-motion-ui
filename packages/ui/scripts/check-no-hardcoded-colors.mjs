#!/usr/bin/env node
/**
 * check-no-hardcoded-colors.mjs — fails if any component file contains a raw
 * hex/rgba color literal that is not annotated with `theme-exempt`.
 *
 * Usage: node scripts/check-no-hardcoded-colors.mjs
 *
 * Exempt patterns (won't fail):
 *  - Any line containing `theme-exempt` (explicit opt-out with required comment)
 *  - Pure-black shadow values: shadowColor '#000'
 *  - Modal backdrop scrims: rgba(0,0,0,0.4 / 0.45)
 *  - Very subtle stripes: rgba(0,0,0,0.02)
 *  - Standard shadow opacities: rgba(0,0,0,0.2)
 *  - NotFound neon glitch aesthetics: #ff0040, #00e5ff
 *  - FeedbackWidget confetti accent: #6366f1
 *
 * The "/* theme-exempt *‌/" comment is the canonical way to document an
 * intentional exception in the source. Run this script again after adding it.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = new URL('.', import.meta.url).pathname;
const srcDir = resolve(__dirname, '../src/components');

// Lines matching these patterns are unconditionally exempt.
const EXEMPT_PATTERNS = [
  /theme-exempt/,                          // explicit opt-out
  /shadowColor/,                           // RN shadow props
  /boxShadow/,                             // web shadow
  /rgba\(0,\s*0,\s*0,\s*0\.4/,            // modal scrims 0.4
  /rgba\(0,\s*0,\s*0,\s*0\.45/,           // modal scrims 0.45
  /rgba\(0,\s*0,\s*0,\s*0\.2\b/,          // shadow 0.2
  /rgba\(0,\s*0,\s*0,\s*0\.02\b/,         // stripe 0.02
  /#ff0040/i,                              // NotFound neon
  /#00e5ff/i,                              // NotFound neon
  /#6366f1/i,                              // FeedbackWidget accent
];

// Regex that matches a hardcoded color token.
const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\s*\(/;

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

const files = walk(srcDir);
let failures = 0;

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!COLOR_RE.test(line)) continue;
    if (EXEMPT_PATTERNS.some((p) => p.test(line))) continue;
    const rel = relative(resolve(__dirname, '../..'), file);
    console.error(`  ${rel}:${i + 1}  ${line.trim()}`);
    failures += 1;
  }
}

if (failures > 0) {
  console.error(`\n✖  ${failures} hardcoded color literal(s) found in src/components.`);
  console.error('   Replace with a useThemeColor() / useThemeColors() call, or add');
  console.error('   a "/* theme-exempt */" comment on the line with a brief rationale.\n');
  process.exit(1);
}

console.log(`✔  No unexempted hardcoded colors in src/components (${files.length} files checked).`);
