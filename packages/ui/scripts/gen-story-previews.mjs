#!/usr/bin/env node
/**
 * gen-story-previews.mjs — draws the thumbnail fixtures the FileSystem stories
 * hand to `previewImageUrl`, and emits them as base64 PNG data URIs:
 *
 *   src/components/file-system/FileSystem/__stories__/file-system-previews.ts
 *
 * Why draw them here rather than ship image files: a story's manifest is plain
 * consumer data, and the previews have to render identically on web and native
 * with nothing to fetch and no fixture server in the test run — so they have to
 * be data URIs. A committed blob with no source is unmaintainable, hence this
 * script: the scenes below are the source, the module is the build product.
 *
 * Each fixture carries the ratio it was *drawn* at, so a manifest entry can
 * declare a truthful `previewAspectRatio`. That matters for the ratio-limit
 * story: `FileThumbnail` clamps a box at 2:1 either way round, so the panorama
 * and the tall shot below are deliberately drawn past the clamp and letterbox
 * onto their paper-white face rather than being cropped.
 *
 * Usage (from packages/ui/):
 *   node scripts/gen-story-previews.mjs
 *   npx biome check --write src/components/file-system/FileSystem/__stories__
 *
 * `--png <dir>` also writes the scenes out as files, which is how you look at
 * what you just drew without booting Storybook.
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_FILE = resolve(
  __dirname,
  '../src/components/file-system/FileSystem/__stories__/file-system-previews.ts',
);

const pngDirArg = process.argv.indexOf('--png');
const PNG_DIR = pngDirArg === -1 ? null : process.argv[pngDirArg + 1];

// ---------------------------------------------------------------------------
// PNG encoder — 8-bit RGB, no alpha
// ---------------------------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Sum of absolute signed byte values — the standard filter-choice heuristic. */
function filterCost(row) {
  let sum = 0;
  for (const byte of row) sum += byte < 128 ? byte : 256 - byte;
  return sum;
}

/**
 * One scanline, filtered. None/Sub/Up are tried and the cheapest wins: flat
 * shapes favour Sub, the vertical gradients every scene starts from favour Up.
 */
function filterRow(line, previous, stride) {
  const none = Buffer.concat([Buffer.from([0]), line]);
  const sub = Buffer.alloc(line.length + 1);
  const up = Buffer.alloc(line.length + 1);
  sub[0] = 1;
  up[0] = 2;
  for (let i = 0; i < line.length; i += 1) {
    sub[i + 1] = (line[i] - (i >= stride ? line[i - stride] : 0)) & 0xff;
    up[i + 1] = (line[i] - previous[i]) & 0xff;
  }
  return [none, sub, up].reduce((best, row) => (filterCost(row) < filterCost(best) ? row : best));
}

function encodePng({ width, height, data }) {
  const stride = 3;
  const rows = [];
  let previous = Buffer.alloc(width * stride);
  for (let y = 0; y < height; y += 1) {
    const line = Buffer.from(data.subarray(y * width * stride, (y + 1) * width * stride));
    rows.push(filterRow(line, previous, stride));
    previous = line;
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/** Supersampling grid per axis: enough to keep a curve or a disc edge smooth. */
const SAMPLES = 4;

function canvas(width, height, fill = [255, 255, 255]) {
  const data = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i += 1) data.set(fill, i * 3);
  return { width, height, data };
}

/**
 * Paint every pixel `inside` covers, in `colour`.
 *
 * `colour` may be a function of position, which is what makes a gradient a fill
 * rather than a special case; coverage comes from a SAMPLES² grid, so edges are
 * antialiased and a 60 px-wide scene still reads as drawn rather than stepped.
 */
function paint(c, inside, colour, alpha = 1) {
  const at = typeof colour === 'function' ? colour : () => colour;
  for (let y = 0; y < c.height; y += 1) {
    for (let x = 0; x < c.width; x += 1) {
      let hits = 0;
      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          if (inside(x + (sx + 0.5) / SAMPLES, y + (sy + 0.5) / SAMPLES)) hits += 1;
        }
      }
      if (hits === 0) continue;
      const coverage = (hits / (SAMPLES * SAMPLES)) * alpha;
      const rgb = at(x, y);
      const offset = (y * c.width + x) * 3;
      for (let ch = 0; ch < 3; ch += 1) {
        c.data[offset + ch] = Math.round(c.data[offset + ch] * (1 - coverage) + rgb[ch] * coverage);
      }
    }
  }
}

const rect = (x, y, w, h) => (px, py) => px >= x && px < x + w && py >= y && py < y + h;
const disc = (cx, cy, r) => (px, py) => (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
const below = (curve) => (px, py) => py >= curve(px);
const above = (curve) => (px, py) => py <= curve(px);

/** Half-plane test for one edge, for the triangle fill below. */
function side(ax, ay, bx, by, px, py) {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

const triangle = (ax, ay, bx, by, cx, cy) => (px, py) => {
  const s1 = side(ax, ay, bx, by, px, py);
  const s2 = side(bx, by, cx, cy, px, py);
  const s3 = side(cx, cy, ax, ay, px, py);
  return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
};

/** A rectangle's outline, `t` thick, drawn inwards. */
const outline = (x, y, w, h, t) => (px, py) =>
  rect(x, y, w, h)(px, py) && !rect(x + t, y + t, w - 2 * t, h - 2 * t)(px, py);

const mix = (from, to, t) => from.map((v, i) => v + (to[i] - v) * t);

/** A top-to-bottom ramp between two colours, over `[y0, y1]`. */
const vertical = (from, to, y0, y1) => (_x, y) => mix(from, to, Math.min(Math.max((y - y0) / (y1 - y0), 0), 1));

/** A sine ridge — the one curve every horizon, dune and hill here is made of. */
const ridge = (base, amplitude, cycles, phase, width) => (x) =>
  base + amplitude * Math.sin((x / width) * cycles * Math.PI + phase);

// ---------------------------------------------------------------------------
// Photo scenes
// ---------------------------------------------------------------------------

function dunes(w = 132, h = 88) {
  const c = canvas(w, h);
  paint(c, () => true, vertical([243, 160, 96], [253, 224, 178], 0, h * 0.62));
  paint(c, disc(w * 0.7, h * 0.36, w * 0.085), [255, 247, 219]);
  paint(c, below(ridge(h * 0.55, h * 0.07, 2.2, 0.4, w)), [216, 162, 104]);
  paint(c, below(ridge(h * 0.7, h * 0.09, 1.6, 2.1, w)), [190, 128, 72]);
  paint(c, below(ridge(h * 0.85, h * 0.07, 1.2, 4.2, w)), [138, 86, 50]);
  return c;
}

function harbour(w = 132, h = 88) {
  const c = canvas(w, h);
  const waterline = h * 0.56;
  paint(c, () => true, vertical([176, 218, 240], [235, 246, 251], 0, waterline));
  // Headland behind the water, then the water itself over its foot.
  paint(c, below(ridge(waterline - h * 0.1, h * 0.06, 1.4, 1.2, w)), [104, 132, 146]);
  paint(c, rect(0, waterline, w, h - waterline), vertical([54, 122, 156], [26, 76, 110], waterline, h));
  // A sloop: two sails off one mast, on a dark hull. The hull is a quad — a
  // waterline wider than the keel — so it reads as a boat rather than a wedge.
  const hullY = h * 0.72;
  paint(c, triangle(w * 0.46, h * 0.3, w * 0.46, hullY, w * 0.3, hullY), [250, 250, 248]);
  paint(c, triangle(w * 0.5, h * 0.36, w * 0.5, hullY, w * 0.64, hullY), [226, 231, 236]);
  paint(c, triangle(w * 0.26, hullY, w * 0.72, hullY, w * 0.66, hullY + h * 0.085), [38, 50, 64]);
  paint(c, triangle(w * 0.26, hullY, w * 0.66, hullY + h * 0.085, w * 0.34, hullY + h * 0.085), [38, 50, 64]);
  // Two light streaks, so the water reads as water rather than as a fill.
  paint(c, rect(w * 0.08, h * 0.88, w * 0.3, 1.5), [148, 190, 214], 0.7);
  paint(c, rect(w * 0.6, h * 0.66, w * 0.26, 1.5), [148, 190, 214], 0.7);
  return c;
}

/** One fir: three stacked triangles over a trunk. */
function fir(c, x, base, height, colour) {
  const half = height * 0.3;
  paint(c, rect(x - height * 0.035, base - height * 0.08, height * 0.07, height * 0.12), [92, 68, 46]);
  for (const [top, spread, foot] of [
    [0, 1, 0.46],
    [0.24, 0.82, 0.7],
    [0.48, 0.62, 0.94],
  ]) {
    paint(
      c,
      triangle(x, base - height * (1 - top), x - half * spread, base - height * (1 - foot), x + half * spread, base - height * (1 - foot)),
      colour,
    );
  }
}

function forest(w = 88, h = 132) {
  const c = canvas(w, h);
  paint(c, () => true, vertical([206, 228, 214], [240, 246, 240], 0, h * 0.62));
  paint(c, below(ridge(h * 0.44, h * 0.05, 1.6, 0.8, w)), [150, 178, 158]);
  paint(c, below(ridge(h * 0.58, h * 0.04, 1.2, 3.4, w)), [110, 146, 122]);
  // Back to front, so the nearest fir overlaps the two behind it.
  fir(c, w * 0.22, h * 0.84, h * 0.4, [62, 106, 78]);
  fir(c, w * 0.78, h * 0.88, h * 0.48, [46, 86, 62]);
  fir(c, w * 0.48, h * 0.96, h * 0.34, [34, 66, 50]);
  paint(c, below(ridge(h * 0.9, h * 0.02, 1, 2, w)), [76, 106, 78]);
  return c;
}

/** 4:1 — past the 2:1 clamp, so its box letterboxes onto white. */
function panorama(w = 240, h = 60) {
  const c = canvas(w, h);
  const horizon = h * 0.58;
  paint(c, () => true, vertical([255, 190, 132], [255, 236, 206], 0, horizon));
  paint(c, disc(w * 0.72, horizon - h * 0.06, h * 0.13), [255, 250, 232]);
  paint(c, rect(0, horizon, w, h * 0.28), vertical([62, 126, 158], [38, 92, 124], horizon, horizon + h * 0.28));
  // The sun's reflection, straight down from it.
  paint(c, rect(w * 0.7, horizon, h * 0.06, h * 0.28), [255, 236, 190], 0.55);
  paint(c, below(ridge(h * 0.86, h * 0.02, 0.8, 1.4, w)), [238, 214, 176]);
  return c;
}

/** 1:3.2 — past the clamp the other way round. */
function lighthouse(w = 60, h = 192) {
  const c = canvas(w, h);
  const sea = h * 0.82;
  paint(c, () => true, vertical([150, 198, 234], [226, 240, 248], 0, sea));
  paint(c, rect(0, sea, w, h - sea), vertical([52, 118, 152], [30, 84, 118], sea, h));
  // A tapering tower: half-width shrinks with height, so the sides slope.
  const towerBase = h * 0.84;
  const towerTop = h * 0.2;
  const halfAt = (y) => w * (0.09 + 0.07 * ((y - towerTop) / (towerBase - towerTop)));
  const tower = (px, py) => py >= towerTop && py <= towerBase && Math.abs(px - w / 2) <= halfAt(py);
  paint(c, tower, [246, 246, 244]);
  for (let band = 0; band < 3; band += 1) {
    const y = towerTop + (towerBase - towerTop) * (0.16 + band * 0.26);
    paint(c, (px, py) => tower(px, py) && py >= y && py < y + h * 0.075, [206, 78, 68]);
  }
  // Lamp room, then the light itself.
  paint(c, rect(w / 2 - w * 0.13, towerTop - h * 0.055, w * 0.26, h * 0.055), [58, 72, 88]);
  paint(c, disc(w / 2, towerTop - h * 0.028, w * 0.06), [255, 226, 132]);
  paint(c, below(ridge(sea - h * 0.01, h * 0.008, 1.2, 0.6, w)), [112, 120, 126]);
  return c;
}

// ---------------------------------------------------------------------------
// Document scenes — a page is white paper with ink on it, so these are drawn as
// margins and rules rather than as pictures.
// ---------------------------------------------------------------------------

const INK = [64, 78, 96];
const FAINT = [186, 195, 206];
const RULE = [222, 227, 233];
const ACCENT = [58, 116, 204];

/** A run of body text: `count` rules, the last one short, like a paragraph. */
function paragraph(c, x, y, w, count, gap, colour = FAINT) {
  for (let line = 0; line < count; line += 1) {
    const width = line === count - 1 ? w * 0.62 : w;
    paint(c, rect(x, y + line * gap, width, 1.6), colour);
  }
}

/** A4-ish portrait: 0.707. */
function invoice(w = 92, h = 130) {
  const c = canvas(w, h);
  const m = w * 0.12;
  paint(c, rect(w - m - 14, m, 14, 14), ACCENT);
  paint(c, rect(m, m + 2, w * 0.36, 4), INK);
  paragraph(c, m, m + 12, w * 0.3, 2, 5);
  paint(c, rect(m, h * 0.34, w - 2 * m, 1.6), INK);
  for (let row = 0; row < 5; row += 1) {
    const y = h * 0.38 + row * h * 0.062;
    if (row % 2 === 1) paint(c, rect(m, y - 2, w - 2 * m, h * 0.052), [244, 246, 249]);
    paint(c, rect(m, y, w * 0.34, 1.6), FAINT);
    paint(c, rect(w - m - w * 0.16, y, w * 0.16, 1.6), FAINT);
  }
  paint(c, rect(m, h * 0.72, w - 2 * m, 1.2), RULE);
  paint(c, rect(w - m - w * 0.4, h * 0.76, w * 0.4, 9), INK);
  return c;
}

/** Report cover: heading, a paragraph, and a bar chart. */
function reportChart(w = 92, h = 130) {
  const c = canvas(w, h);
  const m = w * 0.12;
  paint(c, rect(m, m, w * 0.5, 5), INK);
  paragraph(c, m, m + 12, w - 2 * m, 3, 5);
  const base = h * 0.74;
  const chartWidth = w - 2 * m;
  const bars = [0.42, 0.66, 0.5, 0.86, 0.72];
  bars.forEach((value, index) => {
    const barWidth = (chartWidth / bars.length) * 0.62;
    const x = m + (chartWidth / bars.length) * (index + 0.19);
    const height = value * h * 0.3;
    paint(c, rect(x, base - height, barWidth, height), index === 3 ? ACCENT : [138, 178, 232]);
  });
  paint(c, rect(m, base, chartWidth, 1.2), RULE);
  paragraph(c, m, h * 0.82, chartWidth, 2, 5);
  return c;
}

/** Report body: two columns of text under a subheading. */
function reportText(w = 92, h = 130) {
  const c = canvas(w, h);
  const m = w * 0.12;
  const column = (w - 2 * m - 4) / 2;
  paint(c, rect(m, m, w * 0.42, 4), INK);
  paragraph(c, m, m + 12, column, 9, 5);
  paragraph(c, m + column + 4, m + 12, column, 7, 5);
  paint(c, rect(m + column + 4, m + 12 + 8 * 5, column, h * 0.14), [238, 242, 247]);
  paragraph(c, m, h * 0.78, w - 2 * m, 3, 5);
  return c;
}

/** Report appendix: a donut, then a caption. The page the story loads lazily. */
function reportDonut(w = 92, h = 130) {
  const c = canvas(w, h);
  const m = w * 0.12;
  paint(c, rect(m, m, w * 0.38, 4), INK);
  const cx = w / 2;
  const cy = h * 0.46;
  const r = w * 0.24;
  paint(c, disc(cx, cy, r), [138, 178, 232]);
  paint(c, (px, py) => disc(cx, cy, r)(px, py) && px >= cx && py <= cy, ACCENT);
  paint(c, (px, py) => disc(cx, cy, r)(px, py) && px < cx && py > cy, [244, 162, 97]);
  paint(c, disc(cx, cy, r * 0.52), [255, 255, 255]);
  paragraph(c, m, h * 0.72, w - 2 * m, 4, 5);
  return c;
}

/** 16:9 slide — landscape, but well inside the clamp. */
function slide(w = 160, h = 90) {
  const c = canvas(w, h);
  paint(c, rect(0, 0, w, h * 0.26), [43, 58, 74]);
  paint(c, rect(w * 0.06, h * 0.1, w * 0.4, 4), [255, 255, 255]);
  paint(c, rect(w * 0.06, h * 0.18, w * 0.24, 2.4), [148, 168, 190]);
  paragraph(c, w * 0.06, h * 0.4, w * 0.36, 4, 6);
  paint(c, rect(w * 0.52, h * 0.38, w * 0.42, h * 0.46), [240, 244, 249]);
  const bars = [0.4, 0.72, 0.56, 0.88];
  bars.forEach((value, index) => {
    const barWidth = w * 0.06;
    const x = w * 0.56 + index * w * 0.09;
    const base = h * 0.78;
    paint(c, rect(x, base - value * h * 0.32, barWidth, value * h * 0.32), index === 3 ? ACCENT : [138, 178, 232]);
  });
  return c;
}

/** 10:3 floor plan — the document that goes past the clamp. */
function floorPlan(w = 240, h = 72) {
  const c = canvas(w, h, [247, 249, 251]);
  const wall = [70, 84, 102];
  paint(c, outline(w * 0.04, h * 0.14, w * 0.92, h * 0.72, 2), wall);
  // Interior partitions, with doorway gaps left in them.
  paint(c, rect(w * 0.3, h * 0.14, 2, h * 0.34), wall);
  paint(c, rect(w * 0.3, h * 0.62, 2, h * 0.24), wall);
  paint(c, rect(w * 0.58, h * 0.14, 2, h * 0.5), wall);
  paint(c, rect(w * 0.3, h * 0.48, w * 0.28, 2), wall);
  paint(c, rect(w * 0.58, h * 0.62, w * 0.38, 2), wall);
  // Fixtures and a dimension line under the plan.
  paint(c, outline(w * 0.08, h * 0.2, w * 0.16, h * 0.2, 1.4), [150, 164, 180]);
  paint(c, disc(w * 0.42, h * 0.3, h * 0.08), [150, 164, 180]);
  paint(c, rect(w * 0.64, h * 0.7, w * 0.14, h * 0.1), [150, 164, 180]);
  paint(c, rect(w * 0.04, h * 0.94, w * 0.92, 1.2), [190, 200, 212]);
  return c;
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

/**
 * Every fixture, with the note the emitted module prints above it. The order is
 * the order they appear in the module.
 */
const SCENES = [
  ['dunes', dunes, 'Sunset over dunes — 3:2, the ratio a landscape photo keeps.'],
  ['harbour', harbour, 'A sloop on the water — 3:2.'],
  ['forest', forest, 'Firs on a hillside — 2:3, portrait.'],
  ['panorama', panorama, 'A coastline at 4:1 — twice past the clamp, so it letterboxes.'],
  ['lighthouse', lighthouse, 'A lighthouse at 1:3.2 — past the clamp the other way round.'],
  ['invoice', invoice, 'An invoice page — A4 portrait, the shape a document defaults to.'],
  ['reportChart', reportChart, 'Report page 1: heading, paragraph, bar chart.'],
  ['reportText', reportText, 'Report page 2: two columns of body text.'],
  ['reportDonut', reportDonut, 'Report page 3: a donut and its caption.'],
  ['slide', slide, 'A 16:9 deck slide — landscape, inside the clamp.'],
  ['floorPlan', floorPlan, 'A floor plan at 10:3 — a document past the clamp.'],
];

const HEADER = `// Generated by scripts/gen-story-previews.mjs — do not edit by hand.
//
// The pictures the FileSystem stories hand to \`previewImageUrl\`: drawn scenes,
// emitted as base64 PNGs so they render identically on web and native with
// nothing to fetch and no fixture server in the test run.
//
// Each one carries the ratio it was drawn at, so a manifest entry can declare a
// truthful \`previewAspectRatio\`. Two of them are deliberately drawn past the
// 2:1 box clamp \`FileThumbnail\` applies, which is what the ratio-limit story
// shows: the box stops at the limit and the picture letterboxes onto its
// paper-white face rather than being cropped.

/** A drawn preview: the picture, and the proportions it was drawn at. */
export type StoryPreview = { aspectRatio: number; uri: string };
`;

// Emitted alphabetically rather than in drawing order, so re-ordering or adding
// a scene above only ever moves its own line in the generated module.
const entries = [...SCENES].sort(([a], [b]) => a.localeCompare(b)).map(([name, draw, note]) => {
  const scene = draw();
  const png = encodePng(scene);
  if (PNG_DIR) writeFileSync(resolve(PNG_DIR, `${name}.png`), png);
  const ratio = Number((scene.width / scene.height).toFixed(4));
  const uri = `data:image/png;base64,${png.toString('base64')}`;
  console.log(`${name.padEnd(12)} ${scene.width}×${scene.height}  ratio ${ratio}  ${(uri.length / 1024).toFixed(1)} kB`);
  return `  /** ${note} */\n  ${name}: { aspectRatio: ${ratio}, uri: '${uri}' },`;
}).join('\n');

writeFileSync(OUT_FILE, `${HEADER}\nexport const STORY_PREVIEWS = {\n${entries}\n} satisfies Record<string, StoryPreview>;\n`);
console.log(`\nwrote ${OUT_FILE}`);
