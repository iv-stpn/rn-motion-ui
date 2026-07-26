import { describe, expect, it } from 'vitest';
import { compositeOver, cssColorToOklch, cssColorToSrgb, labToSrgb, oklchToSrgb } from '../color';

const RGB_RE = /^rgb\((\d+), (\d+), (\d+)\)$/;

describe('oklchToSrgb', () => {
  it('converts achromatic extremes exactly', () => {
    expect(oklchToSrgb(1, 0, 0)).toBe('rgb(255, 255, 255)');
    expect(oklchToSrgb(0, 0, 0)).toBe('rgb(0, 0, 0)');
  });

  it('converts perceptual mid-gray to ~50% sRGB', () => {
    // oklch(0.5972 0 0) is the OKLab lightness of #7f7f7f.
    expect(oklchToSrgb(0.5972, 0, 0)).toBe('rgb(127, 127, 127)');
  });

  it('round-trips known chromatic references', () => {
    // Reference values from the CSS Color 4 conversion tables.
    expect(oklchToSrgb(0.6279, 0.2577, 29.2338)).toBe('rgb(255, 0, 0)'); // #ff0000
    expect(oklchToSrgb(0.6231, 0.188, 259.8145)).toBe('rgb(59, 130, 246)'); // tailwind blue-500
  });

  it('emits rgba() when alpha < 1', () => {
    expect(oklchToSrgb(0, 0, 0, 0.1)).toBe('rgba(0, 0, 0, 0.1)');
    expect(oklchToSrgb(1, 0, 0, 0.04)).toBe('rgba(255, 255, 255, 0.04)');
  });

  it('gamut-maps out-of-range chroma by reducing chroma, not clipping channels', () => {
    // A vivid green outside sRGB: naive channel clipping would yield a hue
    // shift; chroma reduction keeps all channels in range with the same hue.
    const result = oklchToSrgb(0.7, 0.4, 145);
    const match = RGB_RE.exec(result);
    expect(match).not.toBeNull();
    const [, r, g, b] = match ?? [];
    expect(Number(g)).toBeGreaterThan(Number(r)); // still green-dominant
    expect(Number(g)).toBeGreaterThan(Number(b));
    expect(Number(g)).toBeLessThanOrEqual(255);
  });
});

describe('cssColorToSrgb', () => {
  it('parses number and percentage lightness', () => {
    expect(cssColorToSrgb('oklch(1 0 0)')).toBe('rgb(255, 255, 255)');
    expect(cssColorToSrgb('oklch(100% 0 0)')).toBe('rgb(255, 255, 255)');
    expect(cssColorToSrgb('oklch(97% 0 0)')).toBe(oklchToSrgb(0.97, 0, 0));
  });

  it('parses slash alpha in both notations', () => {
    expect(cssColorToSrgb('oklch(0 0 0 / 0.1)')).toBe('rgba(0, 0, 0, 0.1)');
    expect(cssColorToSrgb('oklch(0 0 0 / 10%)')).toBe('rgba(0, 0, 0, 0.1)');
  });

  it('parses a deg-suffixed hue', () => {
    expect(cssColorToSrgb('oklch(0.6279 0.2577 29.2338deg)')).toBe('rgb(255, 0, 0)');
  });

  it('scales percentage chroma to the 0.4 = 100% CSS reference range', () => {
    expect(cssColorToSrgb('oklch(0.6279 64.425% 29.2338)')).toBe(oklchToSrgb(0.6279, 0.2577, 29.2338));
  });

  it('passes unconvertible notations through unchanged', () => {
    expect(cssColorToSrgb('#ff0000')).toBe('#ff0000');
    expect(cssColorToSrgb('rgba(0, 0, 0, 0.45)')).toBe('rgba(0, 0, 0, 0.45)');
    expect(cssColorToSrgb('hsl(120 50% 50%)')).toBe('hsl(120 50% 50%)');
    expect(cssColorToSrgb('transparent')).toBe('transparent');
    expect(cssColorToSrgb('color-mix(in oklch, red, blue)')).toBe('color-mix(in oklch, red, blue)');
  });

  it('tolerates surrounding whitespace', () => {
    expect(cssColorToSrgb('  oklch(1 0 0)  ')).toBe('rgb(255, 255, 255)');
  });
});

describe('labToSrgb', () => {
  it('converts achromatic extremes exactly', () => {
    expect(labToSrgb(100, 0, 0)).toBe('rgb(255, 255, 255)');
    expect(labToSrgb(0, 0, 0)).toBe('rgb(0, 0, 0)');
  });

  it('converts L*50 to the ~50% sRGB gray', () => {
    expect(labToSrgb(50, 0, 0)).toBe('rgb(119, 119, 119)');
  });

  it('round-trips the sRGB primaries from their D50 Lab values', () => {
    // lab() is D50-referenced (CSS Color 4) while sRGB is D65, so these only
    // land on exact primaries if the Bradford adaptation is applied.
    expect(labToSrgb(54.2905, 80.8124, 69.8911)).toBe('rgb(255, 0, 0)');
    expect(labToSrgb(87.8181, -79.271, 80.9902)).toBe('rgb(0, 255, 0)');
    expect(labToSrgb(29.5683, 68.2986, -112.029)).toBe('rgb(0, 0, 255)');
  });

  it('emits rgba() when alpha < 1', () => {
    expect(labToSrgb(50, 0, 0, 0.4)).toBe('rgba(119, 119, 119, 0.4)');
  });
});

describe('cssColorToSrgb — lab()', () => {
  // Chromium resolves oklch custom properties to lab() when they are read back
  // through getComputedStyle, which is how useThemeColor(s) reads tokens.css on
  // web. These are verbatim getComputedStyle outputs; the expectations are the
  // browser's own canvas rasterisation of the same strings.
  it('converts browser-resolved token values', () => {
    expect(cssColorToSrgb('lab(93.0185% .0203252 -1.51922)')).toBe('rgb(234, 235, 238)'); // dark foreground
    expect(cssColorToSrgb('lab(7.75991% .03732 -1.50478)')).toBe('rgb(22, 23, 25)'); // dark surface-1
    expect(cssColorToSrgb('lab(96.52% -.0000298023 .0000119209)')).toBe('rgb(245, 245, 245)'); // light surface-1
  });

  it('parses signed components and a missing leading zero', () => {
    expect(cssColorToSrgb('lab(75% -20 55)')).toBe('rgb(172, 194, 76)');
    expect(cssColorToSrgb('lab(60% 40 -30)')).toBe('rgb(193, 117, 199)');
  });

  it('parses a bare-number lightness as well as a percentage', () => {
    expect(cssColorToSrgb('lab(50 0 0)')).toBe(cssColorToSrgb('lab(50% 0 0)'));
  });

  it('scales percentage a/b to the ±125 = 100% CSS reference range', () => {
    expect(cssColorToSrgb('lab(75% -16% 44%)')).toBe(labToSrgb(75, -20, 55));
  });

  it('parses slash alpha', () => {
    expect(cssColorToSrgb('lab(50% 0 0 / 0.4)')).toBe('rgba(119, 119, 119, 0.4)');
    expect(cssColorToSrgb('lab(50% 0 0 / 40%)')).toBe('rgba(119, 119, 119, 0.4)');
  });
});

describe('cssColorToOklch', () => {
  it('parses authored oklch straight through, without a round trip', () => {
    // Direct parsing keeps the authored numbers exact; going via sRGB would
    // quantise them through 8-bit channels first.
    expect(cssColorToOklch('oklch(0.7 0.18 155)')).toEqual({ lightness: 0.7, chroma: 0.18, hue: 155, alpha: 1 });
    // Percentages scale to the CSS reference ranges (chroma 100% = 0.4).
    const percent = cssColorToOklch('oklch(70% 45% 155 / 50%)');
    expect(percent?.lightness).toBeCloseTo(0.7, 6);
    expect(percent?.chroma).toBeCloseTo(0.18, 6);
    expect(percent?.alpha).toBeCloseTo(0.5, 6);
  });

  it('inverts oklchToSrgb to within 8-bit quantisation error', () => {
    // All in-gamut, so the only loss is the 8-bit channel round trip.
    for (const [lightness, chroma, hue] of [
      [0.97, 0, 0],
      [0.7, 0.12, 155],
      [0.205, 0.004, 270],
      [0.6231, 0.188, 259.8145],
    ] as const) {
      const back = cssColorToOklch(oklchToSrgb(lightness, chroma, hue));
      expect(back).not.toBeNull();
      expect(back?.lightness).toBeCloseTo(lightness, 2);
      expect(back?.chroma).toBeCloseTo(chroma, 2);
      // Hue is meaningless at chroma 0 (the sRGB grey axis lands anywhere).
      if (chroma > 0.01) expect(back?.hue).toBeCloseTo(hue, 0);
    }
  });

  it('reads back the gamut-mapped chroma for a color outside sRGB', () => {
    // oklch(0.7 0.18 155) is a vivid green sRGB can't show, so oklchToSrgb
    // reduces its chroma to fit. Reading the result back reports the chroma
    // that was actually painted, not the one that was asked for — which is what
    // a caller deriving further colors from it needs.
    const clamped = cssColorToOklch(oklchToSrgb(0.7, 0.18, 155));
    expect(clamped?.chroma).toBeLessThan(0.18);
    expect(clamped?.chroma).toBeGreaterThan(0.17);
    expect(clamped?.hue).toBeCloseTo(155, 0);
  });

  it('parses hex in every length', () => {
    const blue = cssColorToOklch('#3b82f6');
    expect(blue?.lightness).toBeCloseTo(0.6231, 3);
    expect(blue?.hue).toBeCloseTo(259.81, 1);
    // Shorthand doubles each digit, so #fff is #ffffff.
    expect(cssColorToOklch('#fff')).toEqual(cssColorToOklch('#ffffff'));
    expect(cssColorToOklch('#ffffff')?.lightness).toBeCloseTo(1, 6);
    expect(cssColorToOklch('#3b82f680')?.alpha).toBeCloseTo(0.502, 3);
    expect(cssColorToOklch('#f00c')?.alpha).toBeCloseTo(0.8, 2);
  });

  it('parses rgb() in legacy comma and modern space syntax', () => {
    expect(cssColorToOklch('rgb(59 130 246)')).toEqual(cssColorToOklch('rgb(59, 130, 246)'));
    expect(cssColorToOklch('rgba(59, 130, 246, 0.5)')?.alpha).toBe(0.5);
    expect(cssColorToOklch('rgb(59 130 246 / 50%)')?.alpha).toBe(0.5);
  });

  it('resolves browser-emitted lab() the same as the sRGB path', () => {
    // getComputedStyle hands back lab() for oklch custom properties, so tokens
    // read on web arrive in that notation.
    const fromLab = cssColorToOklch('lab(7.75991% .03732 -1.50478)');
    expect(fromLab?.lightness).toBeCloseTo(0.205, 2); // dark surface-1
  });

  it('normalises hue into 0–360', () => {
    const hue = cssColorToOklch('#ff0000')?.hue;
    expect(hue).toBeGreaterThanOrEqual(0);
    expect(hue).toBeLessThan(360);
    expect(hue).toBeCloseTo(29.23, 1);
  });

  it('returns null for notations it cannot parse', () => {
    // Named colors and keywords have no parser here — callers deriving a
    // palette must fall back rather than get a silently wrong hue.
    expect(cssColorToOklch('red')).toBeNull();
    expect(cssColorToOklch('transparent')).toBeNull();
    expect(cssColorToOklch('currentColor')).toBeNull();
    expect(cssColorToOklch('')).toBeNull();
  });
});

describe('compositeOver', () => {
  it('flattens a translucent layer onto its backdrop', () => {
    // The 6% white lift the glossy key paints over the dark page resolves to
    // the same plate the dark variant pins.
    expect(compositeOver('rgba(255, 255, 255, 0.06)', 'rgb(22, 23, 25)')).toBe('rgb(36, 37, 39)');
    expect(compositeOver('rgba(255, 255, 255, 0.72)', 'rgb(245, 245, 245)')).toBe('rgb(252, 252, 252)');
  });

  it('returns the endpoints at the alpha extremes', () => {
    expect(compositeOver('rgba(0, 0, 0, 0)', 'rgb(12, 34, 56)')).toBe('rgb(12, 34, 56)');
    expect(compositeOver('rgba(0, 0, 0, 1)', 'rgb(12, 34, 56)')).toBe('rgb(0, 0, 0)');
  });

  it('ignores the backdrop for an opaque top layer', () => {
    expect(compositeOver('rgb(10, 20, 30)', 'rgb(255, 255, 255)')).toBe('rgb(10, 20, 30)');
    expect(compositeOver('#3b82f6', 'rgb(0, 0, 0)')).toBe('rgb(59, 130, 246)');
  });

  it('accepts every notation cssColorToSrgb resolves', () => {
    expect(compositeOver('oklch(1 0 0 / 0.5)', 'rgb(0, 0, 0)')).toBe('rgb(128, 128, 128)');
    expect(compositeOver('#ffffff80', 'rgb(0, 0, 0)')).toBe('rgb(128, 128, 128)');
  });

  it('passes an unparseable layer through unchanged', () => {
    expect(compositeOver('red', 'rgb(0, 0, 0)')).toBe('red');
    expect(compositeOver('rgba(255, 255, 255, 0.5)', 'red')).toBe('rgba(255, 255, 255, 0.5)');
  });
});
