/**
 * color — formula-based OKLCH → sRGB conversion.
 *
 * tokens.css declares every color in oklch. Browsers resolve those fine for
 * static CSS, but two consumers need concrete sRGB strings instead:
 *
 *  - React Native (StyleSheet, SVG props) only parses hex/rgb/rgba/hsl.
 *  - Reanimated's color interpolator silently drops non-sRGB values, so an
 *    animated `backgroundColor` set to an oklch string never renders.
 *
 * Conversion is done with the reference OKLab matrices (Björn Ottosson,
 * https://bottosson.github.io/posts/oklab/) — a pure deterministic formula, so
 * the same input yields the same output on native, web, and during SSR (the
 * previous implementation rasterised a 1×1 <canvas> pixel, which only worked
 * in a browser and could vary with the canvas backend).
 *
 * Out-of-gamut colors (e.g. a vivid oklch green whose linear sRGB red channel
 * goes negative) are mapped back into gamut by reducing chroma at constant
 * lightness/hue — the same strategy CSS Color 4 specifies for sRGB display,
 * so results track what browsers render.
 */

// ── OKLab reference matrices ────────────────────────────────────────────────

type Rgb = [number, number, number];

/** Linear-light sRGB for an OKLab triplet (may be out of [0,1] gamut). */
function oklabToLinearSrgb(lightness: number, a: number, b: number): Rgb {
  const l_ = lightness + 0.396_337_777_4 * a + 0.215_803_757_3 * b;
  const m_ = lightness - 0.105_561_345_8 * a - 0.063_854_172_8 * b;
  const s_ = lightness - 0.089_484_177_5 * a - 1.291_485_548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s,
    -1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s,
    -0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s,
  ];
}

/** Gamma-encode one linear channel to the 0–255 sRGB byte range. */
function encodeChannel(linear: number): number {
  const clamped = Math.min(1, Math.max(0, linear));
  const encoded = clamped <= 0.003_130_8 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return Math.round(encoded * 255);
}

/** Linear-light value for one gamma-encoded sRGB byte — encodeChannel inverted. */
function decodeChannel(byte: number): number {
  const channel = Math.min(1, Math.max(0, byte / 255));
  return channel <= 0.040_449_936 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** OKLab for a linear-light sRGB triplet — oklabToLinearSrgb inverted. */
function linearSrgbToOklab([r, g, b]: Rgb): Rgb {
  const l = Math.cbrt(0.412_221_470_8 * r + 0.536_332_536_3 * g + 0.051_445_992_9 * b);
  const m = Math.cbrt(0.211_903_498_2 * r + 0.680_699_545_1 * g + 0.107_396_956_6 * b);
  const s = Math.cbrt(0.088_302_461_9 * r + 0.281_718_837_6 * g + 0.629_978_700_5 * b);
  return [
    0.210_454_255_3 * l + 0.793_617_785 * m - 0.004_072_046_8 * s,
    1.977_998_495_1 * l - 2.428_592_205 * m + 0.450_593_709_9 * s,
    0.025_904_037_1 * l + 0.782_771_766_2 * m - 0.808_675_766 * s,
  ];
}

const GAMUT_EPSILON = 0.000_001;

function isInGamut([r, g, b]: Rgb): boolean {
  return (
    r >= -GAMUT_EPSILON &&
    r <= 1 + GAMUT_EPSILON &&
    g >= -GAMUT_EPSILON &&
    g <= 1 + GAMUT_EPSILON &&
    b >= -GAMUT_EPSILON &&
    b <= 1 + GAMUT_EPSILON
  );
}

/**
 * Linear sRGB for an oklch color, chroma-reduced into gamut if needed.
 *
 * Binary-searches the largest chroma ≤ the requested one that fits in sRGB —
 * constant L and H, matching the CSS Color 4 gamut-mapping intent. ~20
 * iterations lands well below channel quantisation error.
 */
function oklchToLinearSrgbInGamut(lightness: number, chroma: number, hueDeg: number): Rgb {
  const hueRad = (hueDeg * Math.PI) / 180;
  const cosH = Math.cos(hueRad);
  const sinH = Math.sin(hueRad);
  const attempt = oklabToLinearSrgb(lightness, chroma * cosH, chroma * sinH);
  if (isInGamut(attempt)) return attempt;

  let low = 0;
  let high = chroma;
  let best = oklabToLinearSrgb(lightness, 0, 0);
  for (let i = 0; i < 20; i += 1) {
    const mid = (low + high) / 2;
    const candidate = oklabToLinearSrgb(lightness, mid * cosH, mid * sinH);
    if (isInGamut(candidate)) {
      best = candidate;
      low = mid;
    } else high = mid;
  }
  return best;
}

// oklch(L C H) or oklch(L C H / A) — L and A may be percentages or 0–1
// numbers, H may carry a `deg` suffix. Chroma percentages scale to 0.4 = 100%
// per the CSS Color 4 spec.
const OKLCH_RE = /^oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+%?)\s*)?\)$/i;

function parseComponent(raw: string, percentScale: number): number {
  if (raw.endsWith('%')) return (Number.parseFloat(raw) / 100) * percentScale;
  return Number.parseFloat(raw);
}

// ── CIE Lab ─────────────────────────────────────────────────────────────────

/**
 * tokens.css only ever authors `oklch()`, but Chromium *resolves* color custom
 * properties to `lab()` when they are read back through `getComputedStyle` —
 * which is exactly how `useThemeColor(s)` reads them on web. So the library's
 * own tokens arrive here in lab notation, and treating lab as a foreign
 * notation to pass through would hand native code (and any caller that parses
 * the string) a value it cannot read.
 */

// lab(L a b) or lab(L a b / A). L is 0–100 (100% = 100); a and b are signed,
// nominally ±125 (100% = 125); all may be percentages. Values can arrive
// without a leading zero (`.0203252`), so the mantissa pattern allows it.
const LAB_RE = /^lab\(\s*(-?[\d.]+%?)\s+(-?[\d.]+%?)\s+(-?[\d.]+%?)\s*(?:\/\s*([\d.]+%?)\s*)?\)$/i;

const LAB_KAPPA = 24_389 / 27;
const LAB_EPSILON = 216 / 24_389;

// CSS Color 4 reference white for lab() is D50, but sRGB is defined against
// D65, so the two-step below cannot be collapsed without a chromatic adaptation.
const D50_X = 0.3457 / 0.3585;
const D50_Z = (1 - 0.3457 - 0.3585) / 0.3585;

/** D50-referenced XYZ for a CIE Lab triplet. */
function labToXyzD50(lightness: number, a: number, b: number): Rgb {
  const fy = (lightness + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const x = fx ** 3 > LAB_EPSILON ? fx ** 3 : (116 * fx - 16) / LAB_KAPPA;
  const y = lightness > LAB_KAPPA * LAB_EPSILON ? fy ** 3 : lightness / LAB_KAPPA;
  const z = fz ** 3 > LAB_EPSILON ? fz ** 3 : (116 * fz - 16) / LAB_KAPPA;
  return [x * D50_X, y, z * D50_Z];
}

/** Bradford-adapt XYZ from D50 to D65 (CSS Color 4 sample matrix). */
function xyzD50ToD65([x, y, z]: Rgb): Rgb {
  return [
    0.955_473_452_704_218_2 * x - 0.023_098_536_874_261_42 * y + 0.063_259_308_661_021_7 * z,
    -0.028_369_706_963_208_136 * x + 1.009_995_458_005_822_6 * y + 0.021_041_398_966_943_008 * z,
    0.012_314_001_688_319_899 * x - 0.020_507_696_433_477_912 * y + 1.330_365_936_608_075_3 * z,
  ];
}

/** Linear-light sRGB for a D65 XYZ triplet (may be out of [0,1] gamut). */
function xyzD65ToLinearSrgb([x, y, z]: Rgb): Rgb {
  return [
    3.240_969_941_904_522_6 * x - 1.537_383_177_570_094 * y - 0.498_610_760_293_003_4 * z,
    -0.969_243_636_280_879_6 * x + 1.875_967_501_507_720_2 * y + 0.041_555_057_407_175_59 * z,
    0.055_630_079_696_993_66 * x - 0.203_976_958_888_976_52 * y + 1.056_971_514_242_878_6 * z,
  ];
}

// ── gamma-encoded sRGB notations ────────────────────────────────────────────

/** Gamma-encoded sRGB: 0–255 channels plus a 0–1 alpha. */
type Rgba = [number, number, number, number];

// #rgb, #rgba, #rrggbb, #rrggbbaa
const HEX_RE = /^#([\da-f]{3,8})$/i;
// rgb()/rgba(), legacy comma syntax or modern space syntax with slash alpha
const RGB_FN_RE = /^rgba?\(([^)]*)\)$/i;
const RGB_SEPARATOR_RE = /[\s,/]+/;

function parseHex(digits: string): Rgba | null {
  // Shorthand doubles each digit (#abc → #aabbcc); the 4th digit is alpha.
  const size = digits.length === 3 || digits.length === 4 ? 1 : 2;
  if (digits.length !== size * 3 && digits.length !== size * 4) return null;
  const channels: number[] = [];
  for (let i = 0; i < digits.length; i += size) {
    const raw = digits.slice(i, i + size);
    channels.push(Number.parseInt(size === 1 ? raw + raw : raw, 16));
  }
  const [r, g, b, a] = channels;
  if (r === undefined || g === undefined || b === undefined) return null;
  return [r, g, b, a === undefined ? 1 : a / 255];
}

/** Parse a gamma-encoded sRGB string (hex, `rgb()`, `rgba()`) to bytes + alpha. */
function parseSrgb(color: string): Rgba | null {
  const hex = HEX_RE.exec(color);
  if (hex?.[1] !== undefined) return parseHex(hex[1]);

  const fn = RGB_FN_RE.exec(color);
  if (fn?.[1] === undefined) return null;
  const parts = fn[1].trim().split(RGB_SEPARATOR_RE);
  const [rawR, rawG, rawB, rawA] = parts;
  if (rawR === undefined || rawG === undefined || rawB === undefined) return null;

  const channel = (raw: string) => (raw.endsWith('%') ? (Number.parseFloat(raw) / 100) * 255 : Number.parseFloat(raw));
  const rgba: Rgba = [channel(rawR), channel(rawG), channel(rawB), rawA === undefined ? 1 : parseComponent(rawA, 1)];
  return rgba.some(Number.isNaN) ? null : rgba;
}

function formatSrgb(r: number, g: number, b: number, alpha: number): string {
  const bytes = [r, g, b].map((channel) => Math.round(Math.min(255, Math.max(0, channel))));
  if (alpha >= 1) return `rgb(${bytes[0]}, ${bytes[1]}, ${bytes[2]})`;
  return `rgba(${bytes[0]}, ${bytes[1]}, ${bytes[2]}, ${Number(alpha.toFixed(4))})`;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Convert an oklch color to an sRGB color string.
 *
 * @param lightness 0–1 (perceptual lightness; pass 0.97 for `oklch(97% …)`)
 * @param chroma    ≥ 0 (0 is achromatic; sRGB tops out around 0.37)
 * @param hue       degrees, 0–360
 * @param alpha     0–1, defaults to 1 (opaque → `rgb()`, else `rgba()`)
 *
 * @example
 * oklchToSrgb(0.97, 0, 0)            // "rgb(245, 245, 245)"
 * oklchToSrgb(0, 0, 0, 0.1)          // "rgba(0, 0, 0, 0.1)"
 */
export function oklchToSrgb(lightness: number, chroma: number, hue: number, alpha = 1): string {
  const [r, g, b] = oklchToLinearSrgbInGamut(lightness, chroma, hue).map(encodeChannel);
  if (alpha >= 1) return `rgb(${r}, ${g}, ${b})`;
  return `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(4))})`;
}

/**
 * Convert a CIE Lab color to an sRGB color string.
 *
 * @param lightness 0–100 (pass 93.02 for `lab(93.02% …)`)
 * @param a         signed green–red axis, nominally ±125
 * @param b         signed blue–yellow axis, nominally ±125
 * @param alpha     0–1, defaults to 1 (opaque → `rgb()`, else `rgba()`)
 *
 * Unlike the oklch path there is no chroma reduction: lab values reaching this
 * function are browser-resolved forms of tokens that were already sRGB
 * displayable, so `encodeChannel`'s clamp is only a numerical-noise guard.
 *
 * @example
 * labToSrgb(100, 0, 0)  // "rgb(255, 255, 255)"
 */
export function labToSrgb(lightness: number, a: number, b: number, alpha = 1): string {
  const linear = xyzD65ToLinearSrgb(xyzD50ToD65(labToXyzD50(lightness, a, b)));
  const [r, g, blue] = linear.map(encodeChannel);
  if (alpha >= 1) return `rgb(${r}, ${g}, ${blue})`;
  return `rgba(${r}, ${g}, ${blue}, ${Number(alpha.toFixed(4))})`;
}

/**
 * OKLCH components of a color: perceptual `lightness` 0–1, `chroma` ≥ 0, `hue`
 * in degrees 0–360, `alpha` 0–1.
 */
export type OklchColor = { lightness: number; chroma: number; hue: number; alpha: number };

/**
 * Read any supported color notation back as OKLCH — the inverse of
 * {@link oklchToSrgb}, and the entry point for deriving one color from another
 * (lighten, desaturate, pick a contrasting label) the way CSS relative color
 * syntax does with `oklch(from <color> …)`.
 *
 * `oklch()` inputs are parsed directly, so authored values survive untouched.
 * Everything else (`lab()`, hex, `rgb()`, `rgba()`) is resolved to sRGB first
 * and converted back, which quantises through 8-bit channels — irrelevant for
 * deriving colors, but it means `cssColorToOklch(oklchToSrgb(…))` round-trips
 * to within about ±0.002 lightness rather than exactly.
 *
 * Returns `null` for notations this library can't parse (named colors like
 * `red`, `transparent`, `currentColor`, `color()`, `color-mix()`) — callers
 * deriving a palette should fall back to a known color rather than guess.
 *
 * @example
 * const face = cssColorToOklch('rgb(59, 130, 246)');   // { lightness: 0.623, … }
 * const hover = face && oklchToSrgb(face.lightness - 0.1, face.chroma, face.hue);
 */
export function cssColorToOklch(color: string): OklchColor | null {
  const trimmed = color.trim();

  // Authored oklch: parse straight through rather than round-tripping sRGB.
  const direct = OKLCH_RE.exec(trimmed);
  if (direct) {
    const [, rawL, rawC, rawH, rawAlpha] = direct;
    if (rawL === undefined || rawC === undefined || rawH === undefined) return null;
    return {
      lightness: parseComponent(rawL, 1),
      chroma: parseComponent(rawC, 0.4),
      hue: Number.parseFloat(rawH),
      alpha: rawAlpha === undefined ? 1 : parseComponent(rawAlpha, 1),
    };
  }

  const srgb = parseSrgb(cssColorToSrgb(trimmed));
  if (!srgb) return null;
  const [r, g, b, alpha] = srgb;
  const [lightness, a, bAxis] = linearSrgbToOklab([decodeChannel(r), decodeChannel(g), decodeChannel(b)]);
  const hue = (Math.atan2(bAxis, a) * 180) / Math.PI;
  return { lightness, chroma: Math.hypot(a, bAxis), hue: hue < 0 ? hue + 360 : hue, alpha };
}

/**
 * Flatten a translucent color against an opaque backdrop, returning the color
 * actually seen on screen.
 *
 * Blending happens in gamma-encoded sRGB, which is what browsers and React
 * Native both do when compositing a translucent layer — matching the rendered
 * result matters more here than the (more "correct") linear-light blend.
 *
 * Useful when a derived palette needs the *effective* color of a translucent
 * surface: a 6%-white sheet over a near-black page reads as a dark grey, and
 * derivations should key off that grey, not off white.
 *
 * Either argument being unparseable returns `top` unchanged; a `bottom` with
 * its own alpha is treated as opaque.
 *
 * @example
 * compositeOver('rgba(255, 255, 255, 0.06)', 'rgb(22, 23, 25)') // "rgb(36, 37, 39)"
 */
export function compositeOver(top: string, bottom: string): string {
  const over = parseSrgb(cssColorToSrgb(top.trim()));
  const under = parseSrgb(cssColorToSrgb(bottom.trim()));
  if (!(over && under)) return top;
  const [r, g, b, alpha] = over;
  if (alpha >= 1) return formatSrgb(r, g, b, 1);
  const mix = (channel: number, backdrop: number) => channel * alpha + backdrop * (1 - alpha);
  return formatSrgb(mix(r, under[0]), mix(g, under[1]), mix(b, under[2]), 1);
}

/**
 * Resolve a CSS color string to something React Native / Reanimated can parse.
 *
 * `oklch()` and `lab()` strings are converted to `rgb()` / `rgba()` via the
 * formulas above — the library authors oklch, but Chromium resolves those
 * custom properties to lab on the way back out of `getComputedStyle`. Every
 * other notation (hex, rgb, rgba, hsl, named colors) is already sRGB and passes
 * through unchanged.
 *
 * Note: notations this library never emits and no browser resolves ours into
 * (`color()`, `color-mix()`, `oklab()`, …) also pass through unchanged — if you
 * override tokens.css with one of those, resolve it to sRGB yourself before it
 * reaches native code.
 */
export function cssColorToSrgb(color: string): string {
  const trimmed = color.trim();

  const oklch = OKLCH_RE.exec(trimmed);
  if (oklch) {
    const [, rawL, rawC, rawH, rawAlpha] = oklch;
    if (rawL === undefined || rawC === undefined || rawH === undefined) return color;
    const lightness = parseComponent(rawL, 1);
    const chroma = parseComponent(rawC, 0.4);
    const hue = Number.parseFloat(rawH);
    const alpha = rawAlpha === undefined ? 1 : parseComponent(rawAlpha, 1);
    return oklchToSrgb(lightness, chroma, hue, alpha);
  }

  const lab = LAB_RE.exec(trimmed);
  if (lab) {
    const [, rawL, rawA, rawB, rawAlpha] = lab;
    if (rawL === undefined || rawA === undefined || rawB === undefined) return color;
    const lightness = parseComponent(rawL, 100);
    const a = parseComponent(rawA, 125);
    const b = parseComponent(rawB, 125);
    const alpha = rawAlpha === undefined ? 1 : parseComponent(rawAlpha, 1);
    return labToSrgb(lightness, a, b, alpha);
  }

  return color;
}
