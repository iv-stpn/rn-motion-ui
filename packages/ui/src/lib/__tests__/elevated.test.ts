import { describe, expect, it } from 'vitest';
import { clampSurfaceLevel, elevated, elevatedShadow, SURFACE_LEVELS, type SurfaceLevel, surfaceBackground } from '../elevated';

describe('SURFACE_LEVELS', () => {
  it('enumerates the 1–8 ladder in ascending order', () => {
    expect(SURFACE_LEVELS).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('elevatedShadow', () => {
  it('maps each level to its static shadow-elevated-N class', () => {
    for (const level of SURFACE_LEVELS) expect(elevatedShadow(level)).toBe(`shadow-elevated-${level}`);
  });
});

describe('surfaceBackground', () => {
  it('maps each level to its static bg-surface-N class', () => {
    for (const level of SURFACE_LEVELS) expect(surfaceBackground(level)).toBe(`bg-surface-${level}`);
  });
});

describe('clampSurfaceLevel', () => {
  it('passes valid in-range levels through unchanged', () => {
    for (const level of SURFACE_LEVELS) expect(clampSurfaceLevel(level)).toBe(level);
  });

  it('clamps below 1 up to 1', () => {
    expect(clampSurfaceLevel(0)).toBe(1);
    expect(clampSurfaceLevel(-3)).toBe(1);
    expect(clampSurfaceLevel(1)).toBe(1);
  });

  it('clamps above 8 down to 8', () => {
    expect(clampSurfaceLevel(9)).toBe(8);
    expect(clampSurfaceLevel(100)).toBe(8);
  });

  it('rounds fractional inputs to the nearest level', () => {
    expect(clampSurfaceLevel(2.4)).toBe(2);
    expect(clampSurfaceLevel(2.5)).toBe(3);
    expect(clampSurfaceLevel(6.9)).toBe(7);
  });

  it('treats NaN as level 1', () => {
    expect(clampSurfaceLevel(Number.NaN)).toBe(1);
  });

  it('clamps ±Infinity to the ladder ends', () => {
    expect(clampSurfaceLevel(Number.POSITIVE_INFINITY)).toBe(8);
    expect(clampSurfaceLevel(Number.NEGATIVE_INFINITY)).toBe(1);
  });
});

describe('elevated', () => {
  it('couples background and shadow at the same level by default', () => {
    expect(elevated(3)).toBe('bg-surface-3 shadow-elevated-3');
    expect(elevated(6)).toBe('bg-surface-6 shadow-elevated-6');
  });

  it('floats the shadow independently when a shadowLevel is given', () => {
    expect(elevated(3, 6)).toBe('bg-surface-3 shadow-elevated-6');
    expect(elevated(4, 2)).toBe('bg-surface-4 shadow-elevated-2');
  });
});

describe('SurfaceLevel type', () => {
  it('accepts the literal union at compile time', () => {
    const level: SurfaceLevel = 5;
    expect(elevatedShadow(level)).toBe('shadow-elevated-5');
  });
});
