import { describe, expect, it } from 'vitest';
import { hexToHsv, hexToRgb, hslToString, hsvToHex, hsvToHsl, hsvToRgb, parseColor, rgbToHex, rgbToHsv, summarize } from '../hsv';

describe('hsvToRgb', () => {
  it('converts the primary/secondary hues at full saturation and value', () => {
    expect(hsvToRgb(0, 1, 1)).toEqual({ r: 255, g: 0, b: 0 }); // red
    expect(hsvToRgb(60, 1, 1)).toEqual({ r: 255, g: 255, b: 0 }); // yellow
    expect(hsvToRgb(120, 1, 1)).toEqual({ r: 0, g: 255, b: 0 }); // green
    expect(hsvToRgb(180, 1, 1)).toEqual({ r: 0, g: 255, b: 255 }); // cyan
    expect(hsvToRgb(240, 1, 1)).toEqual({ r: 0, g: 0, b: 255 }); // blue
    expect(hsvToRgb(300, 1, 1)).toEqual({ r: 255, g: 0, b: 255 }); // magenta
  });

  it('collapses achromatic colors to grey', () => {
    expect(hsvToRgb(0, 0, 1)).toEqual({ r: 255, g: 255, b: 255 }); // white
    expect(hsvToRgb(240, 0, 0.5)).toEqual({ r: 128, g: 128, b: 128 }); // mid-grey
    expect(hsvToRgb(120, 1, 0)).toEqual({ r: 0, g: 0, b: 0 }); // black
  });

  it('wraps hue outside 0–360', () => {
    expect(hsvToRgb(360, 1, 1)).toEqual(hsvToRgb(0, 1, 1));
    expect(hsvToRgb(-120, 1, 1)).toEqual(hsvToRgb(240, 1, 1));
  });
});

describe('rgbToHsv', () => {
  it('round-trips the primaries', () => {
    expect(rgbToHsv(255, 0, 0)).toEqual({ h: 0, s: 1, v: 1 });
    expect(rgbToHsv(0, 255, 0)).toEqual({ h: 120, s: 1, v: 1 });
    expect(rgbToHsv(0, 0, 255)).toEqual({ h: 240, s: 1, v: 1 });
  });

  it('keeps hue at 0 for achromatic colors', () => {
    expect(rgbToHsv(255, 255, 255)).toEqual({ h: 0, s: 0, v: 1 });
    expect(rgbToHsv(0, 0, 0)).toEqual({ h: 0, s: 0, v: 0 });
  });
});

describe('hex ↔ rgb', () => {
  it('formats bytes to lowercase #rrggbb', () => {
    expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
    expect(rgbToHex(59, 130, 246)).toBe('#3b82f6');
  });

  it('parses #rgb shorthand and 6-digit hex', () => {
    expect(hexToRgb('#f00')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('#3b82f6')).toEqual({ r: 59, g: 130, b: 246 });
  });

  it('ignores alpha digits and a missing leading #', () => {
    expect(hexToRgb('ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('#ff000080')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('returns null for malformed hex', () => {
    expect(hexToRgb('#ggg')).toBeNull();
    expect(hexToRgb('nope')).toBeNull();
  });
});

describe('hsvToHex / hexToHsv', () => {
  it('round-trips through hex', () => {
    const hex = hsvToHex(217, 0.77, 0.96);
    const back = hexToHsv(hex);
    expect(back?.h).toBeCloseTo(217, 0);
    expect(back?.s).toBeCloseTo(0.77, 2);
    expect(back?.v).toBeCloseTo(0.96, 2);
  });
});

describe('hsvToHsl', () => {
  it('maps value and saturation onto lightness', () => {
    expect(hsvToHsl(0, 1, 1)).toEqual({ h: 0, s: 1, l: 0.5 });
    expect(hsvToHsl(0, 0, 0)).toEqual({ h: 0, s: 0, l: 0 });
    expect(hsvToHsl(0, 0, 1)).toEqual({ h: 0, s: 0, l: 1 });
  });

  it('formats to the css hsl() string', () => {
    expect(hslToString(0, 1, 0.5)).toBe('hsl(0, 100%, 50%)');
  });
});

describe('parseColor', () => {
  it('parses hex, rgb() and hsl()', () => {
    expect(parseColor('#ff0000')).toEqual({ h: 0, s: 1, v: 1 });
    expect(parseColor('rgb(255, 0, 0)')).toEqual({ h: 0, s: 1, v: 1 });
    expect(parseColor('rgba(255, 0, 0, 0.5)')).toEqual({ h: 0, s: 1, v: 1 });
    expect(parseColor('hsl(0, 100%, 50%)')).toEqual({ h: 0, s: 1, v: 1 });
  });

  it('returns null for anything else', () => {
    expect(parseColor('red')).toBeNull();
    expect(parseColor('oklch(0.5 0.1 200)')).toBeNull();
  });
});

describe('summarize', () => {
  it('emits every representation for one triplet', () => {
    expect(summarize({ h: 0, s: 1, v: 1 })).toEqual({
      hex: '#ff0000',
      rgb: 'rgb(255, 0, 0)',
      hsl: 'hsl(0, 100%, 50%)',
      hsv: { h: 0, s: 1, v: 1 },
    });
  });
});
