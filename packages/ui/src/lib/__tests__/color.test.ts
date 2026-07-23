import { describe, expect, it } from 'vitest';
import { cssColorToSrgb, oklchToSrgb } from '../color';

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

  it('passes non-oklch notations through unchanged', () => {
    expect(cssColorToSrgb('#ff0000')).toBe('#ff0000');
    expect(cssColorToSrgb('rgba(0, 0, 0, 0.45)')).toBe('rgba(0, 0, 0, 0.45)');
    expect(cssColorToSrgb('hsl(120 50% 50%)')).toBe('hsl(120 50% 50%)');
    expect(cssColorToSrgb('transparent')).toBe('transparent');
  });

  it('tolerates surrounding whitespace', () => {
    expect(cssColorToSrgb('  oklch(1 0 0)  ')).toBe('rgb(255, 255, 255)');
  });
});
