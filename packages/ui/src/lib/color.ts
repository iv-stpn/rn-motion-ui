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
 * Resolve a CSS color string to something React Native / Reanimated can parse.
 *
 * `oklch()` strings are converted to `rgb()` / `rgba()` via the formula above.
 * Every other notation (hex, rgb, rgba, hsl, named colors) is already sRGB and
 * passes through unchanged.
 *
 * Note: notations this library never emits (`color()`, `color-mix()`, `lab()`,
 * `oklab()`, …) also pass through unchanged — if you override tokens.css with
 * one of those, resolve it to sRGB yourself before it reaches native code.
 */
export function cssColorToSrgb(color: string): string {
  const match = OKLCH_RE.exec(color.trim());
  if (!match) return color;
  const [, rawL, rawC, rawH, rawAlpha] = match;
  if (rawL === undefined || rawC === undefined || rawH === undefined) return color;
  const lightness = parseComponent(rawL, 1);
  const chroma = parseComponent(rawC, 0.4);
  const hue = Number.parseFloat(rawH);
  const alpha = rawAlpha === undefined ? 1 : parseComponent(rawAlpha, 1);
  return oklchToSrgb(lightness, chroma, hue, alpha);
}
