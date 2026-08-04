#!/usr/bin/env node
/**
 * gen-icons.mjs — generates one TSX file per MingCute icon into src/icons/,
 * then rewrites the exports map in package.json with a subpath per icon.
 *
 * Usage (from packages/icons/):
 *   node scripts/gen-icons.mjs
 *
 * @iconify-json/mingcute must be installed (dev dep of this package or the
 * monorepo root). Run `bun install` first.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..');
const outDir = resolve(pkgRoot, 'src/icons');
const pkgJsonPath = resolve(pkgRoot, 'package.json');

// ---------------------------------------------------------------------------
// 1. Load @iconify-json/mingcute
// ---------------------------------------------------------------------------

function findIconsJson() {
  for (const candidate of [
    resolve(pkgRoot, 'node_modules/@iconify-json/mingcute/icons.json'),
    resolve(pkgRoot, '../../node_modules/@iconify-json/mingcute/icons.json'),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const iconsJsonPath = findIconsJson();
if (!iconsJsonPath) {
  console.error('@iconify-json/mingcute not found. Run:\n  bun install');
  process.exit(1);
}

const { icons: rawIcons, width: defaultW = 24, height: defaultH = 24 } =
  JSON.parse(readFileSync(iconsJsonPath, 'utf8'));

// ---------------------------------------------------------------------------
// 2. SVG body parser  (recursive descent, no external deps)
// ---------------------------------------------------------------------------

/** Attribute name → JSX camelCase prop name. */
const ATTR_MAP = {
  'fill-rule': 'fillRule',
  'clip-rule': 'clipRule',
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-dashoffset': 'strokeDashoffset',
  'stroke-miterlimit': 'strokeMiterlimit',
  'stroke-opacity': 'strokeOpacity',
  'fill-opacity': 'fillOpacity',
  'clip-path': 'clipPath',
  'stop-color': 'stopColor',
  'stop-opacity': 'stopOpacity',
  'font-size': 'fontSize',
  'font-family': 'fontFamily',
  'text-anchor': 'textAnchor',
  'x1': 'x1', 'y1': 'y1', 'x2': 'x2', 'y2': 'y2',
};

/** SVG tag (lowercase) → react-native-svg import alias. */
const SVG_COMPONENT = {
  path: 'SvgPath',
  circle: 'SvgCircle',
  rect: 'SvgRect',
  ellipse: 'SvgEllipse',
  polygon: 'SvgPolygon',
  polyline: 'SvgPolyline',
  line: 'SvgLine',
  g: 'SvgG',
  defs: 'SvgDefs',
  lineargradient: 'SvgLinearGradient',
  stop: 'SvgStop',
};

/** react-native-svg component alias → export name from the package. */
const SVG_IMPORT_NAME = {
  SvgPath: 'Path',
  SvgCircle: 'Circle',
  SvgRect: 'Rect',
  SvgEllipse: 'Ellipse',
  SvgPolygon: 'Polygon',
  SvgPolyline: 'Polyline',
  SvgLine: 'Line',
  SvgG: 'G',
  SvgDefs: 'Defs',
  SvgLinearGradient: 'LinearGradient',
  SvgStop: 'Stop',
};

/** Parse raw attribute string into a key→value map. */
function parseAttrs(str) {
  const attrs = {};
  let i = 0;
  while (i < str.length) {
    while (i < str.length && /\s/.test(str[i])) i++;
    if (i >= str.length) break;
    // Read name
    const nameStart = i;
    while (i < str.length && !/[\s=/>]/.test(str[i])) i++;
    const name = str.slice(nameStart, i);
    if (!name) { i++; continue; }
    while (i < str.length && /\s/.test(str[i])) i++;
    if (str[i] !== '=') { attrs[name] = true; continue; }
    i++; // skip =
    while (i < str.length && /\s/.test(str[i])) i++;
    if (str[i] === '"' || str[i] === "'") {
      const q = str[i++];
      const valStart = i;
      while (i < str.length && str[i] !== q) i++;
      attrs[name] = str.slice(valStart, i);
      i++; // skip closing quote
    }
  }
  return attrs;
}

/**
 * Recursive SVG body parser.
 * Returns an array of element nodes: { tag, attrs, children }.
 * `pos` is passed by reference via an object.
 */
function parseNodes(body) {
  const cursor = { i: 0 };

  function parseElement() {
    const { } = {}; // just to avoid hoisting issues
    let { i } = cursor;

    // Skip whitespace
    while (i < body.length && /\s/.test(body[i])) i++;
    if (i >= body.length || body[i] !== '<') { cursor.i = i + 1; return null; }

    i++; // skip <

    // Closing tag — signal caller
    if (body[i] === '/') {
      while (i < body.length && body[i] !== '>') i++;
      cursor.i = i + 1;
      return 'CLOSE';
    }

    // Comment / processing instruction — skip
    if (body[i] === '!' || body[i] === '?') {
      while (i < body.length && body[i] !== '>') i++;
      cursor.i = i + 1;
      return null;
    }

    // Tag name
    const nameStart = i;
    while (i < body.length && !/[\s/>]/.test(body[i])) i++;
    const tagName = body.slice(nameStart, i).toLowerCase();

    // Attributes
    let attrStr = '';
    let selfClosing = false;
    while (i < body.length) {
      if (body[i] === '/' && body[i + 1] === '>') { selfClosing = true; i += 2; break; }
      if (body[i] === '>') { i++; break; }
      attrStr += body[i++];
    }
    const attrs = parseAttrs(attrStr.trim());

    const children = [];
    if (!selfClosing) {
      cursor.i = i;
      while (cursor.i < body.length) {
        const ci = cursor.i;
        while (cursor.i < body.length && /\s/.test(body[cursor.i])) cursor.i++;
        if (cursor.i >= body.length || body[cursor.i] !== '<') { cursor.i++; continue; }
        if (body[cursor.i + 1] === '/') {
          // closing tag for this element
          while (cursor.i < body.length && body[cursor.i] !== '>') cursor.i++;
          cursor.i++;
          break;
        }
        const child = parseElement();
        if (child === 'CLOSE') break;
        if (child) children.push(child);
      }
      return { tagName, attrs, children };
    }

    cursor.i = i;
    return { tagName, attrs, children };
  }

  const nodes = [];
  while (cursor.i < body.length) {
    while (cursor.i < body.length && /\s/.test(body[cursor.i])) cursor.i++;
    if (cursor.i >= body.length) break;
    if (body[cursor.i] !== '<') { cursor.i++; continue; }
    if (body[cursor.i + 1] === '/') break;
    const node = parseElement();
    if (node && node !== 'CLOSE') nodes.push(node);
  }
  return nodes;
}

// ---------------------------------------------------------------------------
// 3. JSX emitter
// ---------------------------------------------------------------------------

/** Serialize one attribute to its JSX form. */
function serializeAttr(rawKey, val) {
  const key = ATTR_MAP[rawKey] ?? rawKey;
  if (val === 'currentColor') return `${key}={color}`;
  if (val === true) return key; // boolean attr
  return `${key}="${val}"`;
}

/**
 * Emit JSX for a single node, recursively.
 * `usedComponents` is a Set<string> that gets populated with alias names.
 */
const LINE_WIDTH = 130;

function emitNode(node, indent, usedComponents) {
  const comp = SVG_COMPONENT[node.tagName];
  if (!comp) return ''; // skip unknown/unsupported elements (e.g. <use>)

  usedComponents.add(comp);

  const attrParts = Object.entries(node.attrs)
    .filter(([k]) => k !== 'xmlns' && k !== 'xmlns:xlink')
    .map(([k, v]) => serializeAttr(k, v));
  const attrIndent = `${indent}  `;
  const inlineAttrs = attrParts.length > 0 ? ' ' + attrParts.join(' ') : '';

  if (node.children.length === 0) {
    // ≤1 attr: always inline — Biome can't split a lone string-literal attribute
    if (attrParts.length <= 1) return `${indent}<${comp}${inlineAttrs} />`;
    const inlineLine = `${indent}<${comp}${inlineAttrs} />`;
    if (inlineLine.length <= LINE_WIDTH) return inlineLine;
    // too long — one attr per line
    const multiAttrs = '\n' + attrParts.map(a => `${attrIndent}${a}`).join('\n');
    return `${indent}<${comp}${multiAttrs}\n${indent}/>`;
  }

  const childLines = node.children
    .map(child => emitNode(child, `${indent}  `, usedComponents))
    .filter(Boolean);

  // ≤1 attr: always inline opening tag
  if (attrParts.length <= 1) {
    return `${indent}<${comp}${inlineAttrs}>\n${childLines.join('\n')}\n${indent}</${comp}>`;
  }
  const inlineOpen = `${indent}<${comp}${inlineAttrs}>`;
  if (inlineOpen.length <= LINE_WIDTH) {
    return `${inlineOpen}\n${childLines.join('\n')}\n${indent}</${comp}>`;
  }
  const multiAttrs = '\n' + attrParts.map(a => `${attrIndent}${a}`).join('\n');
  return `${indent}<${comp}${multiAttrs}\n${indent}>\n${childLines.join('\n')}\n${indent}</${comp}>`;
}

/** Convert kebab-case icon name to PascalCase component name. */
function toPascal(name) {
  return name.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

/** Recursively collect all static `id` attribute values from a node tree. */
function collectStaticIds(nodes) {
  const ids = [];
  function walk(node) {
    if (node.attrs?.id) ids.push(node.attrs.id);
    node.children?.forEach(walk);
  }
  nodes.forEach(walk);
  return ids;
}

/** Emit a complete TSX source file for one icon. */
function emitIconFile(iconName, nodes, viewBox, mingcuteVersion) {
  const usedComponents = new Set();
  const childLines = nodes
    .map(n => emitNode(n, '      ', usedComponents))
    .filter(Boolean);

  if (childLines.length === 0) return null; // skip unrenderable icons

  const compName = toPascal(iconName);

  // Build SVG import — one-liner when it fits in 130 chars, multi-line otherwise
  const aliases = [...usedComponents].sort();
  const importItems = aliases.map(alias => `${SVG_IMPORT_NAME[alias]} as ${alias}`).join(', ');
  const svgOneLiner = importItems
    ? `import { Svg, ${importItems} } from 'react-native-svg';`
    : `import { Svg } from 'react-native-svg';`;
  const svgImport = svgOneLiner.length <= LINE_WIDTH
    ? svgOneLiner
    : `import {\n  Svg,\n${aliases.map(a => `  ${SVG_IMPORT_NAME[a]} as ${a},`).join('\n')}\n} from 'react-native-svg';`;

  // Replace static SVG ids with useId()-based dynamic ones to satisfy
  // the lint/correctness/useUniqueElementIds rule.
  const staticIds = collectStaticIds(nodes);
  let useIdImport = '';
  let useIdCall = '';
  let renderedChildren = childLines.join('\n');
  if (staticIds.length > 0) {
    useIdImport = `import { useId } from 'react';\n`;
    useIdCall = '\n  const id = useId();';
    for (const [i, staticId] of staticIds.entries()) {
      renderedChildren = renderedChildren
        .replaceAll(`id="${staticId}"`, `id={\`\${id}-${i}\`}`)
        .replaceAll(`fill="url(#${staticId})"`, `fill={\`url(#\${id}-${i})\`}`)
        .replaceAll(`stroke="url(#${staticId})"`, `stroke={\`url(#\${id}-${i})\`}`);
    }
  }

  return `// AUTO-GENERATED by scripts/gen-icons.mjs — do not edit by hand.
// mingcute icon: ${iconName} · @iconify-json/mingcute v${mingcuteVersion}
${useIdImport}${svgImport}
import { useThemeColor } from 'rn-motion-ui/theme/use-theme-color';
import type { IconProps } from '../icon-props';

export function ${compName}({ size = 24, color: colorProp, style, accessibilityLabel }: IconProps) {
  const defaultColor = useThemeColor('foreground');
  const color = colorProp ?? defaultColor;${useIdCall}
  return (
    <Svg
      width={size}
      height={size}
      viewBox="${viewBox}"
      color={color}
      style={style}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
${renderedChildren}
    </Svg>
  );
}
`;
}

// ---------------------------------------------------------------------------
// 4. Main generation loop
// ---------------------------------------------------------------------------

const mingcuteVersion = (() => {
  const versionPkgPath = resolve(pkgRoot, 'node_modules/@iconify-json/mingcute/package.json');
  try {
    return JSON.parse(readFileSync(versionPkgPath, 'utf8')).version ?? 'unknown';
  } catch {
    return 'unknown';
  }
})();

// icons + global viewport come from the already-loaded JSON (see section 1)
const iconMap = rawIcons;
const viewBox = `0 0 ${defaultW} ${defaultH}`;

mkdirSync(outDir, { recursive: true });

const allNames = Object.keys(iconMap);
console.log(`Generating ${allNames.length} icons from @iconify-json/mingcute v${mingcuteVersion}…`);

let generated = 0;
let skipped = 0;
const skippedNames = [];

for (const name of allNames) {
  const iconData = iconMap[name];
  const body = iconData.body ?? '';

  // react-native-svg does not support <use>; skip those icons
  if (/<use[\s/>]/i.test(body)) {
    skippedNames.push({ name, reason: '<use> element (unsupported in react-native-svg)' });
    skipped++;
    continue;
  }

  const nodes = parseNodes(body);
  const src = emitIconFile(name, nodes, viewBox, mingcuteVersion);

  if (src === null) {
    skippedNames.push({ name, reason: 'no renderable nodes' });
    skipped++;
    continue;
  }

  writeFileSync(resolve(outDir, `${name}.tsx`), src, 'utf8');
  generated++;
}

console.log(`  ✓ ${generated} icons written`);
if (skipped > 0) {
  console.log(`  ⚠ ${skipped} icons skipped:`);
  for (const { name, reason } of skippedNames) {
    console.log(`      ${name}: ${reason}`);
  }
}

// ---------------------------------------------------------------------------
// 5. Update package.json exports
// ---------------------------------------------------------------------------

const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));

// Keep any hand-written exports (./package.json, ./icon-props, etc.)
const kept = Object.fromEntries(
  Object.entries(pkg.exports ?? {}).filter(([k]) => !k.startsWith('./icons/'))
);

// One sub-path entry per generated icon file
const iconExports = {};
for (const name of allNames) {
  if (skippedNames.some(s => s.name === name)) continue;
  const entry = `./icons/${name}`;
  const iconSrc = `./src/icons/${name}.tsx`;
  iconExports[entry] = { source: iconSrc, types: iconSrc, default: iconSrc };
}

pkg.exports = { ...kept, ...iconExports };

writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log(`  ✓ package.json exports updated (${Object.keys(iconExports).length} icon entries)`);

