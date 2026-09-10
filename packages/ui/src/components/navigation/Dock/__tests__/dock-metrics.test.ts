import { describe, expect, it } from 'vitest';
import { DOCK_CAPTION_HEIGHT, DOCK_GAP, DOCK_ICON_SCALE, DOCK_INSET, dockMetrics, dockRowSize } from '../dock-metrics';

/** The three canonical pill sizes spread across Dock's supported range. */
const SIZES: readonly number[] = [20, 28, 36];

/**
 * Exact geometry per size and variant. Every value is closed-form arithmetic
 * on the constants above — the floating point ones land within 1e-9, far past
 * the pen stroke a pill or label can draw, so `toBeCloseTo` pins them tight.
 */
type DockCase = {
  itemPx: number;
  variant: 'compact' | 'labelled';
  iconSize: number;
  width: number;
  height: number;
  iconY: number;
  captionY: number;
};

const CASES: DockCase[] = [
  { itemPx: 20, variant: 'compact', iconSize: 10, width: 24, height: 20, iconY: 5, captionY: 10.6 },
  { itemPx: 20, variant: 'labelled', iconSize: 10, width: 28.8, height: 28, iconY: 2, captionY: 14.6 },
  { itemPx: 28, variant: 'compact', iconSize: 14, width: 33.6, height: 28, iconY: 7, captionY: 16.84 },
  { itemPx: 28, variant: 'labelled', iconSize: 14, width: 40.32, height: 36, iconY: 4, captionY: 20.84 },
  { itemPx: 36, variant: 'compact', iconSize: 18, width: 43.2, height: 36, iconY: 9, captionY: 23.08 },
  { itemPx: 36, variant: 'labelled', iconSize: 18, width: 51.84, height: 46, iconY: 7, captionY: 28.08 },
];

describe('dockMetrics', () => {
  it.each(CASES)('is the $itemPx px $variant pill', (c) => {
    const result = dockMetrics(c.itemPx, c.variant === 'labelled');
    expect(result.iconSize).toBe(c.iconSize);
    expect(result.width).toBeCloseTo(c.width, 9);
    expect(result.height).toBe(c.height);
    expect(result.iconY).toBeCloseTo(c.iconY, 9);
    expect(result.captionY).toBeCloseTo(c.captionY, 9);
  });
});

describe('dockMetrics — compact pill', () => {
  it('keeps the compact width at 1.2x and the height at the raw itemPx', () => {
    for (const itemPx of SIZES) {
      const box = dockMetrics(itemPx, false);
      expect(box.width).toBeCloseTo(itemPx * 1.2, 9);
      expect(box.height).toBe(itemPx);
    }
  });

  it('centres a half-size square: the icon sits in the middle of the pill', () => {
    for (const itemPx of SIZES) {
      const box = dockMetrics(itemPx, false);
      // itemPx is even, so round(itemPx / 2) is exact and the icon doubles it.
      expect(box.iconSize * 2).toBe(itemPx);
      // The icon's midpoint is the pill's midpoint; the spare itemPx − iconSize
      // px split evenly above and below it.
      expect(box.iconY + box.iconSize / 2).toBeCloseTo(itemPx / 2, 9);
    }
  });
});

describe('dockMetrics — labelled pill', () => {
  it('is wider and taller than the compact pill — 1.44x width against 1.2x, plus caption height', () => {
    for (const itemPx of SIZES) {
      const compact = dockMetrics(itemPx, false);
      const labelled = dockMetrics(itemPx, true);
      expect(labelled.width).toBeCloseTo(itemPx * 1.44, 9);
      expect(labelled.width).toBeGreaterThan(compact.width);
      expect(labelled.height).toBeGreaterThan(compact.height);
      // The label adds caption space only; the icon stays the item's half-square.
      expect(labelled.iconSize).toBe(compact.iconSize);
    }
  });

  it('grows with the item size — a smaller item keeps a smaller labelled box', () => {
    const heights = SIZES.map((itemPx) => dockMetrics(itemPx, true).height);
    const widths = SIZES.map((itemPx) => dockMetrics(itemPx, true).width);
    expect(heights).toStrictEqual([28, 36, 46]);
    expect(widths).toStrictEqual([...widths].sort((a, b) => a - b));
  });

  it('is anchored to the item, then grown 23%, unless the icon stack needs more', () => {
    // The first term is the pill's own expansion: itemPx + round((itemPx + 8) * 0.23)
    // — 36 and 46 for 28 and 36 px. For 20 px that rounds to 26, below the icon
    // stack floor (scaled icon + 16 = 28), so the floor is what the label needs.
    for (const itemPx of [28, 36]) {
      const box = dockMetrics(itemPx, true);
      const anchored = itemPx + Math.round((itemPx + DOCK_INSET * 2) * 0.23);
      expect(box.height).toBe(anchored);
    }
    const smallest = dockMetrics(20, true);
    const floor = Math.ceil(dockMetrics(20, false).iconSize * DOCK_ICON_SCALE + 16);
    expect(smallest.height).toBe(floor);
    expect(floor).toBe(28);
  });
});

describe('dockMetrics — icon and caption fit', () => {
  it('keeps the icon and its caption inside the labelled box', () => {
    for (const itemPx of SIZES) {
      const box = dockMetrics(itemPx, true);
      // The icon renders at iconY scaled by DOCK_ICON_SCALE about its own centre.
      const scaledBottom = box.iconY + box.iconSize / 2 + (box.iconSize * DOCK_ICON_SCALE) / 2;
      expect(box.iconY).toBeGreaterThanOrEqual(0);
      expect(scaledBottom).toBeLessThanOrEqual(box.captionY);
      expect(box.captionY + DOCK_CAPTION_HEIGHT).toBeLessThanOrEqual(box.height);
    }
  });

  it('reserves exactly 2px between the scaled icon and the caption', () => {
    for (const itemPx of SIZES) {
      const box = dockMetrics(itemPx, true);
      // The stack height carries a literal "+2" under the scaled icon, and the
      // caption top sits right there — one fixed gap at every size.
      const scaledBottom = box.iconY + box.iconSize / 2 + (box.iconSize * DOCK_ICON_SCALE) / 2;
      expect(box.captionY - scaledBottom).toBeCloseTo(2, 9);
    }
  });
});

describe('dockMetrics — upward icon shift', () => {
  it('lifts the icon centre once a label is added, leaving room for the caption below', () => {
    for (const itemPx of SIZES) {
      const compact = dockMetrics(itemPx, false);
      const labelled = dockMetrics(itemPx, true);
      const compactCentre = compact.iconY + compact.iconSize / 2;
      const labelledCentre = labelled.iconY + labelled.iconSize / 2;
      // Compact icon sits on the pill's middle; the labelled pill re-centres it
      // over the stack height, above the caption.
      expect(labelled.iconY).toBeLessThan(compact.iconY);
      expect(labelledCentre).toBeLessThan(compactCentre);
    }
  });

  it('centres the labelled icon over the stack — not over the taller box', () => {
    for (const itemPx of SIZES) {
      const box = dockMetrics(itemPx, true);
      const stackHeight = box.iconSize * DOCK_ICON_SCALE + 2 + DOCK_CAPTION_HEIGHT;
      // The stack's midpoint lands at (height − stackHeight) / 2; the icon sits on
      // that point, so the offset above the caption mirrors the offset from the
      // box's top — the extra height all comes off the bottom as caption room.
      const stackMid = (box.height - stackHeight) / 2 + (box.iconSize * DOCK_ICON_SCALE) / 2;
      expect(box.iconY + box.iconSize / 2).toBeCloseTo(stackMid, 9);
    }
  });
});

describe('dockRowSize', () => {
  const box = dockMetrics(36, true);

  it('is one box for a single item — no gap to pay when nothing follows', () => {
    const row = dockRowSize(36, true, 1);
    expect(row.width).toBeCloseTo(box.width, 9);
    expect(row.height).toBe(box.height);
  });

  it('adds one gap per boundary — two items cost 2 boxes + 1 gap, three cost 3 boxes + 2 gaps', () => {
    expect(dockRowSize(36, true, 2).width).toBeCloseTo(2 * box.width + DOCK_GAP, 9);
    expect(dockRowSize(36, true, 3).width).toBeCloseTo(3 * box.width + DOCK_GAP * 2, 9);
  });

  it('costs exactly box width plus the gap for each extra item', () => {
    const two = dockRowSize(36, true, 2).width;
    const three = dockRowSize(36, true, 3).width;
    expect(three - two).toBeCloseTo(box.width + DOCK_GAP, 9);
  });

  it('keeps the row height constant — only the width grows with the count', () => {
    for (const count of [1, 2, 3]) expect(dockRowSize(36, true, count).height).toBe(box.height);
  });

  it('collapses to zero width for an empty row, keeping the box height', () => {
    const row = dockRowSize(36, true, 0);
    expect(row.width).toBe(0);
    expect(row.height).toBe(box.height);
  });
});
