#!/usr/bin/env node
/**
 * gen-icons.mjs — regenerates src/lib/icons.tsx from the lucide-react icon set.
 *
 * Usage (from packages/ui/):
 *   node scripts/gen-icons.mjs
 *
 * Requires lucide-react to be installed (add temporarily as a devDependency or
 * run `bun add --dev lucide-react` before invoking). The package is NOT in the
 * published deps because the generated output is committed to the repo.
 *
 * How it works:
 *   1. Reads every per-icon ESM file from node_modules/lucide-react/dist/esm/icons/.
 *   2. Extracts the icon name and SVG node array from the createLucideIcon() call.
 *   3. Maps SVG node names to react-native-svg component aliases.
 *   4. Emits one TSX function per icon, matching the hand-authored format already
 *      present in src/lib/icons.tsx.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..');
const outPath = resolve(pkgRoot, 'src/lib/icons.tsx');

// ---------------------------------------------------------------------------
// 1. Locate lucide-react
// ---------------------------------------------------------------------------

const lucideEsmDir = resolve(pkgRoot, 'node_modules/lucide-react/dist/esm/icons');
const rootLucideEsmDir = resolve(pkgRoot, '../../node_modules/lucide-react/dist/esm/icons');

const iconsDir = existsSync(lucideEsmDir)
  ? lucideEsmDir
  : existsSync(rootLucideEsmDir)
    ? rootLucideEsmDir
    : null;

if (!iconsDir) {
  console.error('lucide-react not found. Install it first:\n  bun add --dev lucide-react');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Detect lucide-react version for the file header
// ---------------------------------------------------------------------------

function findPkgJson(dir) {
  for (const candidate of [
    resolve(dir, '../../../package.json'),
    resolve(dir, '../../../../package.json'),
  ]) {
    if (existsSync(candidate)) {
      try {
        return JSON.parse(readFileSync(candidate, 'utf8'));
      } catch {
        /* skip */
      }
    }
  }
  return null;
}

const lucidePkg = findPkgJson(iconsDir);
const lucideVersion = lucidePkg?.version ?? 'unknown';

// ---------------------------------------------------------------------------
// 3. Parse icon files
// ---------------------------------------------------------------------------

/** SVG element name → react-native-svg alias (mirrors the imports in icons.tsx). */
const SVG_COMPONENT = {
  circle: 'SvgCircle',
  line: 'SvgLine',
  path: 'SvgPath',
  polyline: 'SvgPolyline',
  rect: 'SvgRect',
  polygon: 'SvgPolygon',
  ellipse: 'SvgEllipse',
};

/**
 * Parse all `["tagName", { attr: "val", ... }]` tuples from the second
 * argument of a `createLucideIcon("Name", [...])` call.
 *
 * We use regex rather than a full JS parser to keep this dependency-free
 * and because the generated lucide ESM files follow a very regular format.
 */
function parseNodes(source) {
  // Extract the array literal passed as the second argument to createLucideIcon.
  // The format is always: createLucideIcon("Name", [...]);
  const match = source.match(/createLucideIcon\(\s*["'][^"']+["'],\s*(\[[\s\S]*?\])\s*\)/);
  if (!match) return null;

  const arrayLiteral = match[1];
  const nodes = [];

  // Each node looks like: ["tagName", { key1: "val1", key2: "val2", key: "..." }]
  // The `key` attribute is an internal lucide ID — we skip it in output.
  const nodePattern = /\[\s*["'](\w+)["']\s*,\s*\{([^}]*)\}/g;
  let m;
  while ((m = nodePattern.exec(arrayLiteral)) !== null) {
    const tag = m[1].toLowerCase();
    const attrsRaw = m[2];
    if (!SVG_COMPONENT[tag]) continue; // unsupported element — skip

    const attrs = {};
    const attrPattern = /["']?(\w+)["']?\s*:\s*["']([^"']*)["']/g;
    let am;
    while ((am = attrPattern.exec(attrsRaw)) !== null) {
      if (am[1] === 'key') continue; // lucide internal ID
      attrs[am[1]] = am[2];
    }
    nodes.push({ tag, attrs });
  }
  return nodes;
}

/**
 * PascalCase a kebab-case icon filename: "alert-circle.js" → "AlertCircle".
 */
function toPascal(filename) {
  return basename(filename, '.js')
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

/**
 * Serialise a single attribute value, quoting it for JSX.
 */
function serializeAttr(key, val) {
  // Numeric-ish values (e.g. cx="12") stay as string attributes in JSX.
  return `${key}="${val}"`;
}

/**
 * Emit a single icon component function.
 */
function emitIcon(name, nodes) {
  const children = nodes
    .map(({ tag, attrs }) => {
      const comp = SVG_COMPONENT[tag];
      const attrStr = Object.entries(attrs)
        .map(([k, v]) => serializeAttr(k, v))
        .join(' ');
      return `      <${comp} ${attrStr} />`;
    })
    .join('\n');

  return `export function ${name}({ size = 24, color: colorProp, strokeWidth = 2, style, accessibilityLabel }: IconProps) {
  const defaultColor = useThemeColor('foreground');
  const color = colorProp ?? defaultColor;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      color={color}
      style={style}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
${children}
    </Svg>
  );
}`;
}

// ---------------------------------------------------------------------------
// 4. Gather & sort icon files
// ---------------------------------------------------------------------------

const iconFiles = readdirSync(iconsDir)
  .filter((f) => f.endsWith('.js') && !f.startsWith('index'))
  .sort();

const icons = [];
const skipped = [];

for (const file of iconFiles) {
  const source = readFileSync(resolve(iconsDir, file), 'utf8');
  const name = toPascal(file);
  const nodes = parseNodes(source);
  if (!nodes || nodes.length === 0) {
    skipped.push(name);
    continue;
  }
  icons.push({ name, nodes });
}

if (skipped.length > 0) {
  console.warn(`Skipped ${skipped.length} icon(s) (unsupported element types or parse failure): ${skipped.join(', ')}`);
}

// ---------------------------------------------------------------------------
// 5. Detect which react-native-svg components are actually used
// ---------------------------------------------------------------------------

const usedComponents = new Set();
for (const { nodes } of icons) {
  for (const { tag } of nodes) {
    if (SVG_COMPONENT[tag]) usedComponents.add(SVG_COMPONENT[tag]);
  }
}

const allAliases = Object.values(SVG_COMPONENT);
const importAliases = allAliases
  .filter((c) => usedComponents.has(c))
  .sort()
  .map((alias) => {
    const original = Object.entries(SVG_COMPONENT).find(([, v]) => v === alias)?.[0];
    const capitalized = original.charAt(0).toUpperCase() + original.slice(1);
    return `  ${capitalized} as ${alias}`;
  })
  .join(',\n');

// ---------------------------------------------------------------------------
// 6. Emit the file
// ---------------------------------------------------------------------------

const header = `// AUTO-GENERATED by scripts/gen-icons.mjs — do not edit by hand.
// lucide-react v${lucideVersion} icon geometry (ISC) rendered via react-native-svg, so the
// same icon set works on native + react-native-web without the (uncached) RN pkg.
// biome-ignore-all lint/style/noExcessiveLinesPerFile: generated icon set — each icon is a single function; splitting would require a barrel re-export
import type { StyleProp, ViewStyle } from 'react-native';
import { useThemeColor } from '../theme/use-theme-color';
import {
  Svg,
${importAliases},
} from 'react-native-svg';

export type IconProps = {
  /** Square edge length in px. */
  size?: number;
  /** Stroke colour. Passed as react-native-svg \`color\` (acts as currentColor). */
  color?: string;
  /** Stroke width in user units (default 2, matching lucide). */
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
  /** Accessibility label; when omitted the icon is decorative. */
  accessibilityLabel?: string;
};
`;

const body = icons.map(({ name, nodes }) => emitIcon(name, nodes)).join('\n\n');
const output = `${header}\n${body}\n`;

writeFileSync(outPath, output);
console.log(`✔  Generated ${icons.length} icons → src/lib/icons.tsx`);
