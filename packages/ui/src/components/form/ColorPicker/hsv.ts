/**
 * hsv — HSV ↔ RGB ↔ hex ↔ HSL conversion for the color picker.
 *
 * The picker's internal model is HSV: the saturation/value panel's two axes are
 * the S and V channels, and the hue slider drives H. Everything the user sees —
 * the panel gradients, the trigger swatch, the readout — is derived from that
 * one triplet.
 *
 * Pure and dependency-free so the same math runs identically on web, native and
 * in unit tests (the picker's tests import this module directly, no JSX).
 */

// ── internal helpers ─────────────────────────────────────────────────────────

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));
const clamp01 = (value: number) => clamp(value, 0, 1);

/** Normalise any degrees value into [0, 360). */
function normaliseHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

// #rgb, #rgba, #rrggbb, #rrggbbaa — the leading `#` is optional.
const HEX_RE = /^#?([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i;

/** Grab the first three numeric tokens out of an `fn(...)` body, whatever the separator. */
function parseFunctionBody(raw: string, fn: string): [number, number, number] | null {
  const match = new RegExp(`^${fn}\\((.*)\\)$`).exec(raw.trim());
  const body = match?.[1];
  if (!body) return null;
  const tokens = body.match(/[\d.]+/g);
  if (!tokens || tokens.length < 3) return null;
  const r = Number(tokens[0]);
  const g = Number(tokens[1]);
  const b = Number(tokens[2]);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return [r, g, b];
}

// ── types ────────────────────────────────────────────────────────────────────

/** Hue in degrees [0, 360), saturation and value each in [0, 1]. */
export type Hsv = { h: number; s: number; v: number };

/** Gamma-encoded sRGB bytes, 0–255 each. */
export type Rgb = { r: number; g: number; b: number };

/** HSL triplet — hue in degrees, saturation and lightness each in [0, 1]. */
export type Hsl = { h: number; s: number; l: number };

/** Every representation the picker reports, in one object. */
export type ColorSummary = { hex: string; rgb: string; hsl: string; hsv: Hsv };

// ── HSV ↔ RGB ───────────────────────────────────────────────────────────────

/** HSV to gamma-encoded sRGB bytes. */
export function hsvToRgb(h: number, s: number, v: number): Rgb {
  const hue = normaliseHue(h);
  const sat = clamp01(s);
  const val = clamp01(v);

  const c = val * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - c;

  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/** Gamma-encoded sRGB bytes to HSV. */
export function rgbToHsv(r: number, g: number, b: number): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / d) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
  }

  return { h: normaliseHue(h), s: max === 0 ? 0 : d / max, v: max };
}

// ── Hex ─────────────────────────────────────────────────────────────────────

/** Format bytes as an `#rrggbb` string. */
export function rgbToHex(r: number, g: number, b: number): string {
  const to = (byte: number) =>
    Math.round(clamp(byte, 0, 255))
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Parse a hex string (alpha ignored — the picker is opaque) or return null. */
export function hexToRgb(hex: string): Rgb | null {
  const match = HEX_RE.exec(hex.trim());
  if (!match?.[1]) return null;

  const raw = match[1];
  // Shorthand doubles each digit (#abc → #aabbcc); the 4th digit is alpha.
  const digits =
    raw.length === 3 || raw.length === 4
      ? raw
          .split('')
          .map((digit) => digit + digit)
          .join('')
      : raw;

  return {
    r: Number.parseInt(digits.slice(0, 2), 16),
    g: Number.parseInt(digits.slice(2, 4), 16),
    b: Number.parseInt(digits.slice(4, 6), 16),
  };
}

/** HSV to `#rrggbb`. */
export function hsvToHex(h: number, s: number, v: number): string {
  const { r, g, b } = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}

/** Hex string to HSV, or null when it does not parse. */
export function hexToHsv(hex: string): Hsv | null {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsv(rgb.r, rgb.g, rgb.b) : null;
}

// ── HSL ─────────────────────────────────────────────────────────────────────

/** HSV to HSL (all channels normalised to their own domain). */
export function hsvToHsl(h: number, s: number, v: number): Hsl {
  const hue = normaliseHue(h);
  const sat = clamp01(s);
  const val = clamp01(v);

  const l = val * (1 - sat / 2);
  const sl = l === 0 || l === 1 ? 0 : (val - l) / Math.min(l, 1 - l);

  return { h: hue, s: clamp01(sl), l };
}

/** HSL to gamma-encoded sRGB bytes. */
export function hslToRgb(h: number, s: number, l: number): Rgb {
  const hue = normaliseHue(h);
  const sat = clamp01(s);
  const light = clamp01(l);

  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/** Format an HSL triplet as `hsl(h, s%, l%)`. */
export function hslToString(h: number, s: number, l: number): string {
  return `hsl(${Math.round(normaliseHue(h))}, ${Math.round(clamp01(s) * 100)}%, ${Math.round(clamp01(l) * 100)}%)`;
}

// ── parsing a color string ──────────────────────────────────────────────────

/**
 * Parse a color string into HSV. Accepts hex (`#rgb`, `#rrggbb`, `#rrggbbaa`,
 * leading `#` optional) and the `rgb()` / `rgba()` / `hsl()` / `hsla()`
 * functions (comma- or space-separated, with or without an alpha channel).
 * Alpha is ignored — the picker is opaque. Returns null when it cannot parse.
 */
export function parseColor(input: string): Hsv | null {
  const raw = input.trim().toLowerCase();

  if (raw.startsWith('#')) {
    const rgb = hexToRgb(raw);
    return rgb ? rgbToHsv(rgb.r, rgb.g, rgb.b) : null;
  }

  if (raw.startsWith('rgb')) {
    const rgb = parseFunctionBody(raw, 'rgba?');
    return rgb ? rgbToHsv(rgb[0], rgb[1], rgb[2]) : null;
  }

  if (raw.startsWith('hsl')) {
    const hsl = parseFunctionBody(raw, 'hsla?');
    if (!hsl) return null;
    // Saturation/lightness may be 0–1 or 0–100; normalise the latter.
    const to01 = (n: number) => (n > 1 ? n / 100 : clamp01(n));
    const rgb = hslToRgb(hsl[0], to01(hsl[1]), to01(hsl[2]));
    return rgbToHsv(rgb.r, rgb.g, rgb.b);
  }

  return null;
}

// ── summary ─────────────────────────────────────────────────────────────────

/** Build the `onChange` payload for an HSV triplet. */
export function summarize(hsv: Hsv): ColorSummary {
  const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
  const hsl = hsvToHsl(hsv.h, hsv.s, hsv.v);
  return {
    hex: rgbToHex(r, g, b),
    rgb: `rgb(${r}, ${g}, ${b})`, // theme-exempt: emits an rgb() string from computed channels, not a literal
    hsl: hslToString(hsl.h, hsl.s, hsl.l),
    hsv: { h: normaliseHue(hsv.h), s: clamp01(hsv.s), v: clamp01(hsv.v) },
  };
}
