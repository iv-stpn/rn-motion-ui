import { describe, expect, it } from 'vitest';
import { type SpotlightRect, spotlightGeometry } from '../spotlight-layout';

const VIEWPORT = { width: 400, height: 800 };

function area(r: SpotlightRect): number {
  return r.width * r.height;
}

describe('spotlightGeometry', () => {
  it('tiles the four shades exactly around the hole, leaving only the hole undimmed', () => {
    const target: SpotlightRect = { x: 100, y: 200, width: 100, height: 50 };
    const { hole, shades } = spotlightGeometry(target, VIEWPORT.width, VIEWPORT.height);

    const shaded = shades.reduce((sum, shade) => sum + area(shade), 0);
    expect(shaded + area(hole)).toBe(VIEWPORT.width * VIEWPORT.height);

    // Every shade is non-negative.
    for (const shade of shades) {
      expect(shade.width).toBeGreaterThanOrEqual(0);
      expect(shade.height).toBeGreaterThanOrEqual(0);
    }
  });

  it('inflates the hole by padding', () => {
    const target: SpotlightRect = { x: 10, y: 10, width: 40, height: 20 };
    const { hole } = spotlightGeometry(target, VIEWPORT.width, VIEWPORT.height, { padding: 4 });
    expect(hole).toEqual({ x: 6, y: 6, width: 48, height: 28 });
  });

  it('places the tooltip below the hole when it fits', () => {
    const target: SpotlightRect = { x: 100, y: 200, width: 100, height: 50 };
    const { tooltip, below } = spotlightGeometry(target, VIEWPORT.width, VIEWPORT.height);
    expect(below).toBe(true);
    // gap (12) below the hole.
    expect(tooltip.y).toBe(200 - 4 + 50 + 8 + 12);
  });

  it('flips the tooltip above the hole when it does not fit below', () => {
    const target: SpotlightRect = { x: 100, y: 750, width: 100, height: 30 };
    const { tooltip, below } = spotlightGeometry(target, VIEWPORT.width, VIEWPORT.height);
    expect(below).toBe(false);
    expect(tooltip.y).toBeLessThan(750);
  });

  it('clamps the tooltip horizontally to the viewport margins', () => {
    const target: SpotlightRect = { x: 350, y: 100, width: 40, height: 20 };
    const { tooltip } = spotlightGeometry(target, VIEWPORT.width, VIEWPORT.height);
    // 400 - 16 (margin) - 280 (tooltipWidth) = 104.
    expect(tooltip.x).toBe(104);
  });

  it('keeps shades non-negative for a target at the top-left corner', () => {
    const target: SpotlightRect = { x: 0, y: 0, width: 20, height: 20 };
    const { shades } = spotlightGeometry(target, VIEWPORT.width, VIEWPORT.height);
    for (const shade of shades) {
      expect(shade.width).toBeGreaterThanOrEqual(0);
      expect(shade.height).toBeGreaterThanOrEqual(0);
    }
  });
});
