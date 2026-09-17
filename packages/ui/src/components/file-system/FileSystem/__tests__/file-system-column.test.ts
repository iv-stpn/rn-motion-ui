import { describe, expect, it } from 'vitest';
import {
  COLUMN_PADDING,
  COLUMN_ROW_GAP,
  COLUMN_ROW_HEIGHT,
  COLUMN_ROW_STRIDE,
  COLUMN_WIDTH,
  columnRowHitAt,
  columnRowsInRect,
} from '../logic/file-system-column';

function entries(...paths: string[]): readonly { path: string }[] {
  return paths.map((path) => ({ path }));
}

describe('column geometry constants', () => {
  it('keeps the pane width, row height and stride in lockstep', () => {
    expect(COLUMN_WIDTH).toBe(240);
    expect(COLUMN_ROW_HEIGHT).toBe(28);
    expect(COLUMN_ROW_GAP).toBe(1);
    expect(COLUMN_ROW_STRIDE).toBe(COLUMN_ROW_HEIGHT + COLUMN_ROW_GAP);
    expect(COLUMN_PADDING).toBe(6);
  });
});

describe('columnRowHitAt', () => {
  it('maps the top of the first row', () => {
    expect(columnRowHitAt(0, COLUMN_PADDING, 0, 3)).toBe(0);
  });

  it('maps a point inside a row to that row', () => {
    expect(columnRowHitAt(0, COLUMN_PADDING + 14, 0, 3)).toBe(0);
  });

  it('maps the start of the second row', () => {
    expect(columnRowHitAt(0, COLUMN_PADDING + COLUMN_ROW_STRIDE, 0, 3)).toBe(1);
  });

  it('returns null inside the gap between rows', () => {
    // The last px of row 0's stride is the gap, not the row.
    expect(columnRowHitAt(0, COLUMN_PADDING + COLUMN_ROW_HEIGHT, 0, 3)).toBeNull();
  });

  it('returns null above the first row (top padding)', () => {
    expect(columnRowHitAt(0, COLUMN_PADDING - 1, 0, 3)).toBeNull();
  });

  it('returns null past the last row', () => {
    expect(columnRowHitAt(0, COLUMN_PADDING + 3 * COLUMN_ROW_STRIDE, 0, 3)).toBeNull();
  });

  it('returns null when there are no rows', () => {
    expect(columnRowHitAt(0, COLUMN_PADDING, 0, 0)).toBeNull();
  });

  it('accounts for scroll offset when locating the row', () => {
    // One stride scrolled: the point that was the top of row 1 now sits at the
    // top of the viewport.
    expect(columnRowHitAt(0, COLUMN_PADDING, COLUMN_ROW_STRIDE, 3)).toBe(1);
  });

  it('ignores the horizontal position', () => {
    expect(columnRowHitAt(0, COLUMN_PADDING, 0, 3)).toBe(columnRowHitAt(COLUMN_WIDTH - 1, COLUMN_PADDING, 0, 3));
  });
});

describe('columnRowsInRect', () => {
  it('returns the paths of every row a rect overlaps', () => {
    const rect = { x: 0, y: COLUMN_PADDING, width: COLUMN_WIDTH, height: 3 * COLUMN_ROW_STRIDE };
    expect(columnRowsInRect(rect, entries('a', 'b', 'c'))).toEqual(['a', 'b', 'c']);
  });

  it('returns a single row when the rect matches one row exactly', () => {
    const rect = { x: 0, y: COLUMN_PADDING, width: COLUMN_WIDTH, height: COLUMN_ROW_HEIGHT };
    expect(columnRowsInRect(rect, entries('a', 'b'))).toEqual(['a']);
  });

  it('returns nothing for a rect that only covers the gap', () => {
    const rect = { x: 0, y: COLUMN_PADDING + COLUMN_ROW_HEIGHT, width: COLUMN_WIDTH, height: COLUMN_ROW_GAP };
    expect(columnRowsInRect(rect, entries('a', 'b'))).toEqual([]);
  });

  it('returns nothing for a rect in the top padding', () => {
    const rect = { x: 0, y: 0, width: COLUMN_WIDTH, height: COLUMN_PADDING };
    expect(columnRowsInRect(rect, entries('a'))).toEqual([]);
  });

  it('returns nothing for a rect in the bottom padding', () => {
    const rect = { x: 0, y: COLUMN_PADDING + 3 * COLUMN_ROW_STRIDE, width: COLUMN_WIDTH, height: COLUMN_PADDING };
    expect(columnRowsInRect(rect, entries('a', 'b', 'c'))).toEqual([]);
  });

  it('includes a row even when the rect clips only into its top', () => {
    // The rect starts 10 px into row 1 and reaches down into row 2.
    const rect = { x: 0, y: COLUMN_PADDING + COLUMN_ROW_STRIDE + 10, width: COLUMN_WIDTH, height: COLUMN_ROW_STRIDE + 10 };
    expect(columnRowsInRect(rect, entries('a', 'b', 'c'))).toEqual(['b', 'c']);
  });

  it('returns nothing for no entries', () => {
    const rect = { x: 0, y: COLUMN_PADDING, width: COLUMN_WIDTH, height: COLUMN_ROW_HEIGHT };
    expect(columnRowsInRect(rect, [])).toEqual([]);
  });
});
