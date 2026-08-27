#!/usr/bin/env node
/**
 * gen-file-icons.mjs — converts the file-type icon SVGs into react-native-svg
 * modules used by FileIcon: `file-icon-glyphs.tsx` and `file-icon-metrics.ts`.
 *
 * Sources live beside the output, in `FileIcon/svg/` (see its README):
 *   - `categories/*.svg` → the tintable per-category badges. Each is a `<g>`
 *     glyph whose category colour is replaced by a `{color}` prop so the render
 *     layer can tint it.
 *   - `paper.svg`        → the paper itself, the empty file every badge is drawn
 *     on. Real vector art — gradients, blurred drop shadow, curled corner —
 *     emitted once as `FilePaperGlyph` rather than repeated in all 16 badges. It
 *     supersedes the 512-square raster template the badges were originally
 *     composed over; `BADGE_SHEET` below is what bridges the two.
 *   - `brands/*.svg`     → fixed-colour brand glyphs (PDF, the MS Office suite,
 *     Flash, AI, Video), emitted verbatim with `{width}`/`{height}`.
 *
 * Every glyph is emitted with its *ink bounds* as the viewBox rather than the
 * canvas it was authored on (see `ink` below), so `width`/`height` are what it
 * draws and carry no padding. That is what lets the render layer put every file
 * icon on one shared width — the authored canvases pad by anything from 0% to
 * 25%, so sizing by them makes a page look small next to a PDF.
 *
 * Usage (from packages/ui/):
 *   node scripts/gen-file-icons.mjs
 *   npx biome check --write src/components/file-system/FileIcon
 *
 * The emitter writes readable-but-unformatted JSX, so the biome pass is part of
 * the loop rather than an afterthought — `bun run lint` checks formatting.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..');
const iconDir = resolve(pkgRoot, 'src/components/file-system/FileIcon');
const outPath = resolve(iconDir, 'file-icon-glyphs.tsx');
const metricsOutPath = resolve(iconDir, 'file-icon-metrics.ts');

/** The vendored art, beside the output it is generated into. */
const SOURCE = resolve(iconDir, 'svg');

// ---------------------------------------------------------------------------
// Category badges (svg/categories). `color` is the exact hex the art is drawn
// in, and is what gets swapped for the dynamic `{color}` prop.
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { file: 'audio.svg', name: 'FileAudio', color: '#a63d9f' },
  { file: 'apk.svg', name: 'FileApk', color: '#2d9a58' },
  { file: 'archive.svg', name: 'FileArchive', color: '#bd6a21' },
  { file: 'certificate.svg', name: 'FileCertificate', color: '#b68a19' },
  { file: 'code.svg', name: 'FileCode', color: '#2877a8' },
  { file: 'config.svg', name: 'FileConfig', color: '#667085' },
  { file: 'database.svg', name: 'FileDatabase', color: '#256c9b' },
  { file: 'disk-image.svg', name: 'FileDiskImage', color: '#6c7785' },
  { file: 'document.svg', name: 'FileDocument', color: '#5273b8' },
  { file: 'executable.svg', name: 'FileExecutable', color: '#c24d37' },
  { file: 'font.svg', name: 'FileFont', color: '#7952a1' },
  { file: 'image.svg', name: 'FileImage', color: '#218f85' },
  { file: 'library.svg', name: 'FileLibrary', color: '#7652a6' },
  { file: 'script.svg', name: 'FileScript', color: '#b36c18' },
  { file: 'terminal.svg', name: 'FileTerminal', color: '#35475d' },
  { file: '3d.svg', name: 'File3d', color: '#5c7cbe' },
];

// ---------------------------------------------------------------------------
// Brand glyphs (svg/brands), fixed colour.
//
// `ink` is the bounding box of what the file actually draws, `[x, y, w, h]` in
// its own viewBox units, and becomes the emitted viewBox. Most of these are
// full-bleed (ink === viewBox), but Flash, AI and Video are authored with a
// margin, and Acrobat ships no viewBox at all.
//
// Measured, not eyeballed: load the source SVG in a browser, move its children
// into one `<g>`, and read `g.getBBox()`. Re-measure when a source is replaced —
// `verifyInk` below only catches ink that falls outside the declared viewBox.
// ---------------------------------------------------------------------------

const BRANDS = [
  { file: 'pdf.svg', name: 'FilePdf', ink: [0, 0, 256, 256] },
  { file: 'word.svg', name: 'FileWord', ink: [0, 0, 1881.25, 1750] },
  { file: 'excel.svg', name: 'FileExcel', ink: [0, 0, 2289.75, 2130] },
  { file: 'powerpoint.svg', name: 'FilePowerPoint', ink: [0, 0, 1919.95, 1786] },
  { file: 'onenote.svg', name: 'FileOneNote', ink: [0, 0, 2744.833, 2553.333] },
  { file: 'flash.svg', name: 'FileFlash', ink: [2, 2.328, 28, 27.344] },
  { file: 'ai.svg', name: 'FileAi', ink: [2, 2.35, 28, 27.3] },
  { file: 'video.svg', name: 'FileVideo', ink: [2, 1, 20, 22] },
];

// ---------------------------------------------------------------------------
// The paper: the empty file the category badges are drawn on. Vector art in a
// 128-square, so it ships as shapes rather than as a raster.
//
// `sheet` is the opaque page alone, `[x, y, w, h]`. Read straight off the
// `page-shape` path and confirmed against a render.
//
// `ink` is everything the file draws, blurred drop shadow included — the render
// layer crops to this box, so anything left out would be cut off rather than
// merely uncounted. Measured by rasterising at 8× (`rsvg-convert -w 1024`) and
// scanning the alpha channel for the first and last pixel above zero, hence the
// eighth-of-a-unit steps.
// ---------------------------------------------------------------------------

const PAPER = { file: 'paper.svg', size: 128, sheet: [21, 6, 86, 114], ink: [16.375, 3.625, 95.25, 123.125] };

// The page the category badges were composed over: the retired 512-square PNG
// template. The badge sources still carry its coordinates, so the render layer
// maps this box onto `PAPER.sheet` to land them on the vector page. Measured the
// same way, on the template's own alpha channel, but at the opaque threshold —
// it is the sheet the glyphs were positioned against, not the shadow around it.
const BADGE_SHEET = [76, 8, 360, 472];

// How low a category badge draws, in that same 512-square: the bottom edge of
// the lowest-drawing glyph in the set (the 3-D cube, at 356; most stop around
// 330). Measured by rasterising each `categories/*.svg` at 4× and taking the
// lowest ink pixel across all of them.
//
// It is the top of the band the extension label is printed in, so a redrawn
// badge that dips below it is one that would collide with the label.
const BADGE_INK_BOTTOM = 356;

// ---------------------------------------------------------------------------
// SVG body parser (adapted from packages/icons/scripts/gen-icons.mjs)
// ---------------------------------------------------------------------------

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
};

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
  // Tag names arrive lower-cased from the parser.
  clippath: 'SvgClipPath',
  filter: 'SvgFilter',
  fegaussianblur: 'SvgFeGaussianBlur',
};

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
  SvgClipPath: 'ClipPath',
  SvgFilter: 'Filter',
  SvgFeGaussianBlur: 'FeGaussianBlur',
};

function parseAttrs(str) {
  const attrs = {};
  let i = 0;
  while (i < str.length) {
    while (i < str.length && /\s/.test(str[i])) i++;
    if (i >= str.length) break;
    const nameStart = i;
    while (i < str.length && !/[\s=/>]/.test(str[i])) i++;
    const name = str.slice(nameStart, i);
    if (!name) { i++; continue; }
    while (i < str.length && /\s/.test(str[i])) i++;
    if (str[i] !== '=') { attrs[name] = true; continue; }
    i++;
    while (i < str.length && /\s/.test(str[i])) i++;
    if (str[i] === '"' || str[i] === "'") {
      const q = str[i++];
      const valStart = i;
      while (i < str.length && str[i] !== q) i++;
      attrs[name] = str.slice(valStart, i);
      i++;
    }
  }
  return attrs;
}

function parseNodes(body) {
  const cursor = { i: 0 };

  function parseElement() {
    let { i } = cursor;
    while (i < body.length && /\s/.test(body[i])) i++;
    if (i >= body.length || body[i] !== '<') { cursor.i = i + 1; return null; }
    i++;
    if (body[i] === '/') { while (i < body.length && body[i] !== '>') i++; cursor.i = i + 1; return 'CLOSE'; }
    if (body[i] === '!' || body[i] === '?') { while (i < body.length && body[i] !== '>') i++; cursor.i = i + 1; return null; }

    const nameStart = i;
    while (i < body.length && !/[\s/>]/.test(body[i])) i++;
    const tagName = body.slice(nameStart, i).toLowerCase();

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
        while (cursor.i < body.length && /\s/.test(body[cursor.i])) cursor.i++;
        if (cursor.i >= body.length || body[cursor.i] !== '<') { cursor.i++; continue; }
        if (body[cursor.i + 1] === '/') {
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
// Emitter
// ---------------------------------------------------------------------------

function serializeAttr(rawKey, val) {
  const key = ATTR_MAP[rawKey] ?? rawKey;
  if (val === true) return key;
  return `${key}="${val}"`;
}

/** Normalise a node's attributes into JSX prop parts. */
function attrPartsOf(node) {
  const attrs = { ...node.attrs };
  delete attrs.xmlns;
  delete attrs['xmlns:xlink'];
  delete attrs['xlink:href'];
  // Office SVGs put the stop colour in `style="stop-color:#…"`.
  if (attrs.style) {
    const stopColor = /stop-color:\s*([^;]+)/i.exec(attrs.style);
    if (stopColor) attrs.stopColor = stopColor[1];
    delete attrs.style;
  }
  return Object.entries(attrs).map(([k, v]) => serializeAttr(k, v));
}

function emitNode(node, indent, used) {
  const comp = SVG_COMPONENT[node.tagName];
  if (!comp) return '';
  used.add(comp);

  const attrParts = attrPartsOf(node);
  const inlineAttrs = attrParts.length > 0 ? ` ${attrParts.join(' ')}` : '';

  if (node.children.length === 0) {
    return `${indent}<${comp}${inlineAttrs} />`;
  }
  const childLines = node.children
    .map((child) => emitNode(child, `${indent}  `, used))
    .filter(Boolean);
  return `${indent}<${comp}${inlineAttrs}>\n${childLines.join('\n')}\n${indent}</${comp}>`;
}

/** Collect every static `id` attribute (gradient ids) from a node tree. */
function collectStaticIds(nodes) {
  const ids = [];
  const walk = (node) => {
    if (node.attrs?.id) ids.push(node.attrs.id);
    node.children?.forEach(walk);
  };
  nodes.forEach(walk);
  return ids;
}

/** The attributes that can point at an `id`, so uniquing has to rewrite them too. */
const ID_REF_ATTRS = ['fill', 'stroke', 'clipPath', 'filter', 'mask'];

/**
 * Rewrite every static `id` — and every `url(#…)` pointing at one — to a value
 * derived from a `useId()` call. Two instances of the same glyph on screen would
 * otherwise both resolve `url(#page)` to whichever one rendered last.
 *
 * Matching is on the full `id="x"` / `url(#x)` spelling, so an id that is a
 * prefix of another (`page` vs `page-shape`) cannot be clobbered by it.
 */
function uniquifyIds(rendered, ids) {
  let out = rendered;
  for (const [i, staticId] of ids.entries()) {
    out = out.replaceAll(`id="${staticId}"`, `id={\`\${id}-${i}\`}`);
    for (const attr of ID_REF_ATTRS) {
      out = out.replaceAll(`${attr}="url(#${staticId})"`, `${attr}={\`url(#\${id}-${i})\`}`);
    }
  }
  return out;
}

/**
 * Resolve every `<use href="#id">` into a copy of what it points at, then drop
 * the shapes that existed only to be stamped out.
 *
 * Sharing a shape and stamping it is the right way to hand-write an SVG and the
 * wrong way to ship one here: `<Use>` on native needs the referenced node to
 * survive in `<Defs>`, and a `<Use>` inside a `<ClipPath>` is thinner ice still.
 * Expanding costs a few duplicated path strings and leaves plain shapes behind.
 */
function expandUses(nodes) {
  const byId = new Map();
  const index = (node) => {
    if (node.attrs?.id) byId.set(node.attrs.id, node);
    node.children?.forEach(index);
  };
  nodes.forEach(index);

  const consumed = new Set();

  const resolve = (node) => {
    if (node.tagName !== 'use') return { ...node, children: node.children.map(resolve) };

    const ref = (node.attrs.href ?? node.attrs['xlink:href'] ?? '').replace(/^#/, '');
    const target = byId.get(ref);
    if (!target) throw new Error(`<use> points at unknown id "${ref}"`);
    consumed.add(ref);

    const { href: _href, 'xlink:href': _xlink, id: _id, x, y, transform, ...inherited } = node.attrs;
    // A `<use>`'s presentation attributes are inherited by the instance, so
    // whatever the target sets for itself wins over them.
    const attrs = { ...inherited, ...target.attrs };
    delete attrs.id;

    // `x`/`y` are a translate nested inside the `<use>`'s own transform, and the
    // target's transform nests inside that again.
    const shift = x !== undefined || y !== undefined ? `translate(${x ?? 0} ${y ?? 0})` : '';
    const chain = [transform, shift, target.attrs.transform].filter(Boolean).join(' ');
    if (chain) attrs.transform = chain;
    else delete attrs.transform;

    return { tagName: target.tagName, attrs, children: target.children.map(resolve) };
  };

  const expanded = nodes.map(resolve);

  const prune = (node) => {
    const children = node.children ?? [];
    const kept = node.tagName === 'defs' ? children.filter((c) => !consumed.has(c.attrs?.id)) : children;
    return { ...node, children: kept.map(prune) };
  };
  return expanded.map(prune);
}

function readSvg(...segments) {
  return readFileSync(join(SOURCE, ...segments), 'utf8');
}

/** Children of the root `<svg>` element (drops the `<?xml`/`<svg>` wrapper). */
function svgChildren(svg) {
  const root = parseNodes(svg).find((n) => n.tagName === 'svg');
  return root?.children ?? [];
}

function extractViewBox(svg) {
  const m = /viewBox="([^"]+)"/.exec(svg);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Render one category badge → `FileXBadge({ color })`. The paper is drawn by
// the render layer; the badge is the tintable glyph layered on top of it.
// ---------------------------------------------------------------------------

function emitBadge(category) {
  const inner = svgChildren(readSvg('categories', category.file));
  const glyph = inner.find((n) => n.tagName === 'g') ?? { tagName: 'g', attrs: {}, children: inner };

  const used = new Set(['SvgG']);
  const children = glyph.children
    .map((n) => emitNode(n, '    ', used))
    .filter(Boolean)
    .join('\n');
  const body = children.replaceAll(`"${category.color}"`, '{color}');

  return {
    name: `${category.name}Badge`,
    used,
    useId: false,
    body,
  };
}

// ---------------------------------------------------------------------------
// Render one brand glyph → `FileXGlyph({ size })`.
// ---------------------------------------------------------------------------

/**
 * Warn when a brand's recorded ink escapes the viewBox its file declares — the
 * one way a stale measurement shows up as a cropped logo rather than a wrong
 * aspect ratio. A file with no viewBox (Acrobat) has nothing to check against.
 */
function verifyInk(brand, svg) {
  const declared = extractViewBox(svg);
  if (!declared) return;
  const [vx, vy, vw, vh] = declared.trim().split(/[\s,]+/).map(Number);
  const [x, y, w, h] = brand.ink;
  if (x < vx || y < vy || x + w > vx + vw || y + h > vy + vh)
    console.warn(`  ! ${brand.name}: ink [${brand.ink}] falls outside viewBox "${declared}" — re-measure it.`);
}

function emitBrand(brand) {
  const svg = readSvg('brands', brand.file);
  verifyInk(brand, svg);
  const viewBox = brand.ink.join(' ');
  const nodes = svgChildren(svg);

  const used = new Set(['Svg']);
  let rendered = nodes.map((n) => emitNode(n, '      ', used)).filter(Boolean).join('\n');

  const staticIds = collectStaticIds(nodes);
  const useId = staticIds.length > 0;
  if (useId) rendered = uniquifyIds(rendered, staticIds);

  return { name: `${brand.name}Glyph`, used, useId, useIdCall: useId ? '\n  const id = useId();' : '', viewBox, body: rendered };
}

// ---------------------------------------------------------------------------
// Render the paper → `FilePaperGlyph()`, the empty page the render layer draws
// under every category badge.
// ---------------------------------------------------------------------------

function emitPaper() {
  const nodes = expandUses(svgChildren(readSvg(PAPER.file)));

  const used = new Set(['SvgG']);
  let rendered = nodes.map((n) => emitNode(n, '      ', used)).filter(Boolean).join('\n');

  const staticIds = collectStaticIds(nodes);
  const useId = staticIds.length > 0;
  if (useId) rendered = uniquifyIds(rendered, staticIds);

  return { name: 'FilePaperGlyph', used, useId, useIdCall: useId ? '\n  const id = useId();' : '', body: rendered };
}

// ---------------------------------------------------------------------------
// Render the ink bounds → `file-icon-metrics.ts`. Plain data, no react-native
// import, so the layout maths that reads it stays unit-testable.
// ---------------------------------------------------------------------------

const inkLiteral = ([x, y, width, height]) => `{ x: ${x}, y: ${y}, width: ${width}, height: ${height} }`;

function emitMetrics() {
  const brandEntries = BRANDS.map((b) => `  ${b.name}: ${inkLiteral(b.ink)},`).join('\n');

  return `// AUTO-GENERATED by scripts/gen-file-icons.mjs — do not edit by hand.
// What each glyph draws, as opposed to the canvas it was authored on: the
// bounding box of its ink, in its own viewBox units. Each glyph is emitted with
// these as its viewBox, so its \`width\`/\`height\` are the drawn size — which is
// what lets every file icon share one width and still keep its own height.

/** A glyph's ink, in the units of the canvas it was authored on. */
export type FileGlyphInk = { x: number; y: number; width: number; height: number };

/** Ink bounds of the brand logos, measured off each source file with \`getBBox\`. */
export const FILE_BRAND_INK = {
${brandEntries}
} satisfies Record<string, FileGlyphInk>;

/**
 * Ink bounds of the paper the category badges sit on, in its own ${PAPER.size}-square.
 * The blurred drop shadow counts as ink: the render layer clips to this box, so
 * anything left out of it would be cut off rather than merely uncounted.
 */
export const FILE_PAPER_INK: FileGlyphInk = ${inkLiteral(PAPER.ink)};

/** The opaque page alone — the paper's ink minus the shadow around it. */
export const FILE_PAPER_SHEET: FileGlyphInk = ${inkLiteral(PAPER.sheet)};

/**
 * The same page on the retired 512-square raster template, which is the canvas
 * the category badges are still authored against. Mapping this box onto
 * \`FILE_PAPER_SHEET\` is what lands a badge on the vector page.
 */
export const FILE_BADGE_SHEET: FileGlyphInk = ${inkLiteral(BADGE_SHEET)};

/**
 * How low a badge draws on that template — the bottom edge of the lowest-drawing
 * glyph in the set, measured across all of them. Everything below it is page, so
 * it is the top of the band the extension label is printed in.
 */
export const FILE_BADGE_INK_BOTTOM = ${BADGE_INK_BOTTOM};
`;
}

// ---------------------------------------------------------------------------
// Assemble the module
// ---------------------------------------------------------------------------

const badges = CATEGORIES.map(emitBadge);
const brands = BRANDS.map(emitBrand);
const paper = emitPaper();

const allUsed = new Set();
for (const item of [paper, ...badges, ...brands]) for (const u of item.used) allUsed.add(u);
const needsUseId = paper.useId || brands.some((b) => b.useId);

const importItems = [...allUsed]
  .filter((alias) => alias !== 'Svg')
  .sort()
  .map((alias) => `${SVG_IMPORT_NAME[alias]} as ${alias}`)
  .join(', ');
const svgImport = importItems
  ? `import { Svg, ${importItems} } from 'react-native-svg';`
  : `import { Svg } from 'react-native-svg';`;
const useIdImport = needsUseId ? `import { useId } from 'react';\n` : '';

const paperBlock = `/**
 * The empty page every category badge is drawn on: gradient sheet, blurred drop
 * shadow, curled corner. Drawn in its own ${PAPER.size}-square by the render layer,
 * which supplies the enclosing \`<Svg>\` and crops it to \`FILE_PAPER_INK\`.
 */
export function ${paper.name}() {${paper.useIdCall}
  return (
    <SvgG>
${paper.body}
    </SvgG>
  );
}`;

const badgeBlocks = badges.map((b) =>
  `/** Tintable category badge (paper is drawn by the render layer). */
export function ${b.name}({ color }: BadgeProps) {
  return (
    <SvgG>
${b.body}
    </SvgG>
  );
}`,
);

const brandBlocks = brands.map((b) =>
  `/** Fixed-colour brand glyph. */
export function ${b.name}({ width, height }: GlyphProps) {${b.useIdCall}
  return (
    <Svg width={width} height={height} viewBox="${b.viewBox}">
${b.body}
    </Svg>
  );
}`,
);

const output = `// AUTO-GENERATED by scripts/gen-file-icons.mjs — do not edit by hand.
// File-type glyphs: the shared paper, the tintable category badges drawn on it,
// and the fixed-colour brand logos (PDF, MS Office, Flash, AI, Video).
${useIdImport}${svgImport}

type BadgeProps = { color: string };
/** The drawn box. Both are given: a glyph's viewBox is its ink, so it has an aspect ratio of its own. */
type GlyphProps = { width: number; height: number };

${[paperBlock, ...badgeBlocks, ...brandBlocks].join('\n\n')}
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, output, 'utf8');
writeFileSync(metricsOutPath, emitMetrics(), 'utf8');
console.log(`  ✓ paper + ${badges.length} category badges + ${brands.length} brand glyphs → ${outPath}`);
console.log(`  ✓ ink bounds → ${metricsOutPath}`);
