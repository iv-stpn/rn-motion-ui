import { describe, expect, it } from 'vitest';
import {
  GRID_GAP,
  GRID_PADDING,
  MIN_TILE_WIDTH,
  type MobileGridMetrics,
  mobileGridMetrics,
} from '../logic/file-system-mobile-grid';

/** What a row of `columns` tiles actually spends, gaps and padding included. */
const rowExtent = ({ columns, tileWidth }: MobileGridMetrics) =>
  columns * tileWidth + GRID_GAP * (columns - 1) + GRID_PADDING * 2;

describe('mobileGridMetrics', () => {
  // The touch grid was drawn as a two-column layout, and the stories and their
  // play functions read it that way. Packing by width must not disturb that at
  // any width a phone actually reports.
  it.each([320, 360, 375, 390, 414, 430])('keeps a %ipt phone two across', (width) => {
    expect(mobileGridMetrics(width).columns).toBe(2);
  });

  it('leaves phone-width tiles exactly where the fixed two-column math had them', () => {
    // (360 - 12*2 - 8) / 2 — the layout before columns were packed by width.
    expect(mobileGridMetrics(360).tileWidth).toBe(164);
  });

  it('packs more columns as the container grows', () => {
    expect(mobileGridMetrics(768).columns).toBeGreaterThan(2);
    expect(mobileGridMetrics(1024).columns).toBeGreaterThan(mobileGridMetrics(768).columns);
  });

  it('never packs a column narrower than the minimum', () => {
    for (let width = MIN_TILE_WIDTH + GRID_PADDING * 2; width <= 2000; width += 1) {
      const metrics = mobileGridMetrics(width);
      expect(metrics.tileWidth).toBeGreaterThanOrEqual(MIN_TILE_WIDTH);
    }
  });

  it('fits its row inside the container it measured', () => {
    for (let width = 0; width <= 2000; width += 1)
      expect(rowExtent(mobileGridMetrics(width))).toBeLessThanOrEqual(Math.max(width, GRID_PADDING * 2));
  });

  it('drops to a single column rather than squeezing below the minimum', () => {
    expect(mobileGridMetrics(240).columns).toBe(1);
  });

  it('reports no tile width before the first layout', () => {
    expect(mobileGridMetrics(0).tileWidth).toBe(0);
  });
});
