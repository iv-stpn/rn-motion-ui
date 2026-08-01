import { describe, expect, it } from 'vitest';
import { CHECKBOX_COL_WIDTH } from '../table-types';
import { columnBoundaries, dropIndexAt, dropIndicatorX } from '../table-utils';

type Col = { key: string; header: string };

const COLS: Col[] = [
  { key: 'a', header: 'A' },
  { key: 'b', header: 'B' },
  { key: 'c', header: 'C' },
];
const WIDTHS = { a: 100, b: 200, c: 100 };
const WIDTH = 400;

const edges = (selectable = false) => columnBoundaries(COLS, WIDTHS, selectable);

/** Insertion index for a pointer at physical `px`, in one direction. */
const indexAt = (px: number, isRTL: boolean, selectable = false) =>
  dropIndexAt({ px, boundaries: edges(selectable), containerWidth: WIDTH, isRTL });

const indicatorAt = (dropIndex: number, isRTL: boolean, selectable = false) =>
  dropIndicatorX({ boundaries: edges(selectable), dropIndex, containerWidth: WIDTH, isRTL });

describe('columnBoundaries', () => {
  it('accumulates one logical edge per column plus the total', () => {
    expect(edges()).toEqual([0, 100, 300, 400]);
  });

  it('offsets everything by the checkbox column when selectable', () => {
    const w = CHECKBOX_COL_WIDTH;
    expect(edges(true)).toEqual([w, w + 100, w + 300, w + 400]);
  });

  it('treats an unmeasured column as zero-width rather than NaN', () => {
    expect(columnBoundaries(COLS, { a: 100 }, false)).toEqual([0, 100, 100, 100]);
  });
});

describe('dropIndexAt', () => {
  it('returns the index whose midpoint the pointer has not yet passed', () => {
    // Columns: a [0,100) b [100,300) c [300,400). Midpoints: 50, 200, 350.
    expect(indexAt(10, false)).toBe(0);
    expect(indexAt(49, false)).toBe(0);
    expect(indexAt(51, false)).toBe(1);
    expect(indexAt(199, false)).toBe(1);
    expect(indexAt(201, false)).toBe(2);
    expect(indexAt(349, false)).toBe(2);
  });

  it('returns one past the last column beyond the final midpoint', () => {
    expect(indexAt(351, false)).toBe(3);
    expect(indexAt(WIDTH, false)).toBe(3);
  });

  it('mirrors the pointer under RTL, so the same physical x means a different column', () => {
    // Physical 10 is the far *right* — past every logical midpoint.
    expect(indexAt(10, true)).toBe(3);
    // Physical 390 is the far left, i.e. logical ~10 — before the first midpoint.
    expect(indexAt(390, true)).toBe(0);
  });

  it('agrees with LTR at the mirrored coordinate, for every column', () => {
    for (const px of [10, 49, 51, 199, 201, 349, 351]) expect(indexAt(WIDTH - px, true)).toBe(indexAt(px, false));
  });

  it('is not the same as LTR anywhere except the exact centre', () => {
    // Guards the mirror actually being applied: a no-op implementation would
    // make these equal. 200 is the centre of a 400px container, so it maps to
    // itself and is excluded.
    const differing = [10, 51, 351].filter((px) => indexAt(px, true) !== indexAt(px, false));
    expect(differing).toHaveLength(3);
  });

  it('offsets by the checkbox column in both directions', () => {
    const w = CHECKBOX_COL_WIDTH;
    // First column now spans [w, w+100); its midpoint is w+50.
    expect(indexAt(w + 49, false, true)).toBe(0);
    expect(indexAt(w + 51, false, true)).toBe(1);
    expect(indexAt(WIDTH - (w + 49), true, true)).toBe(0);
    expect(indexAt(WIDTH - (w + 51), true, true)).toBe(1);
  });

  it('clamps rather than throwing when the pointer leaves the container', () => {
    expect(indexAt(-50, false)).toBe(0);
    expect(indexAt(WIDTH + 50, false)).toBe(3);
    expect(indexAt(-50, true)).toBe(3);
    expect(indexAt(WIDTH + 50, true)).toBe(0);
  });

  it('has no column to land in when there are none', () => {
    expect(dropIndexAt({ px: 10, boundaries: [0], containerWidth: WIDTH, isRTL: false })).toBe(0);
    expect(dropIndexAt({ px: 10, boundaries: [], containerWidth: WIDTH, isRTL: false })).toBe(0);
  });
});

describe('dropIndicatorX', () => {
  it('sits on the logical edge in LTR', () => {
    expect(indicatorAt(0, false)).toBe(0);
    expect(indicatorAt(1, false)).toBe(100);
    expect(indicatorAt(2, false)).toBe(300);
  });

  it('keeps the trailing edge inside the container', () => {
    // Boundary 3 is the full width; a 2px line there would paint out of view.
    expect(indicatorAt(3, false)).toBe(WIDTH - 2);
  });

  it('mirrors to the other side of the same edge under RTL', () => {
    // Each line sits just *before* its mirrored edge, hence the -2.
    expect(indicatorAt(1, true)).toBe(WIDTH - 100 - 2);
    expect(indicatorAt(2, true)).toBe(WIDTH - 300 - 2);
    // The first edge is the container's right in RTL — clamped inside it.
    expect(indicatorAt(0, true)).toBe(WIDTH - 2);
    // …and the last is its left.
    expect(indicatorAt(3, true)).toBe(0);
  });

  it('stays within the container for every index, in both directions', () => {
    for (const isRTL of [false, true]) {
      for (let i = 0; i < edges().length; i += 1) {
        const x = indicatorAt(i, isRTL);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(WIDTH - 2);
      }
    }
  });

  it('lands on the edge the hit-test chose, in both directions', () => {
    // The indicator and the commit have to agree, or the line points at a
    // boundary the release does not use. Both derive from the same table, so
    // this pins the pairing rather than the arithmetic.
    for (const isRTL of [false, true]) {
      for (const px of [10, 150, 250, 390]) {
        const i = indexAt(px, isRTL);
        const x = indicatorAt(i, isRTL);
        const edge = edges()[i] ?? 0;
        const logical = isRTL ? WIDTH - x - 2 : x;
        // Equal except where clamping pulled the line inside the container.
        if (x > 0 && x < WIDTH - 2) expect(logical).toBe(edge);
      }
    }
  });

  it('honours a custom thickness', () => {
    const args = { boundaries: edges(), containerWidth: WIDTH, isRTL: true, thickness: 6 };
    expect(dropIndicatorX({ ...args, dropIndex: 1 })).toBe(WIDTH - 100 - 6);
    expect(dropIndicatorX({ ...args, dropIndex: 3 })).toBe(0);
  });
});
