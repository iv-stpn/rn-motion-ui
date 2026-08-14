import { describe, expect, it } from 'vitest';
import {
  chunkEntries,
  gridMetrics,
  ROW_STRIDE,
  TILE_HEIGHT,
  tileAt,
  tileCorner,
  tileHitAt,
  tilesInRect,
} from '../logic/file-system-icons-grid';
import type { FileSystemEntry } from '../types/file-system.types';

const lookup = { columns: 4, scrollOffset: 0, tileWidth: 100 };

function file(name: string): FileSystemEntry {
  return { key: name, kind: 'file', name, parentPath: '', path: name };
}

describe('gridMetrics', () => {
  it('packs at least one column even in a viewport narrower than a tile', () => {
    expect(gridMetrics(40).columns).toBe(1);
  });

  it('keeps every column at or above the minimum width', () => {
    const { columns, tileWidth } = gridMetrics(800);
    expect(columns).toBeGreaterThan(1);
    expect(tileWidth).toBeGreaterThanOrEqual(104);
  });
});

describe('chunkEntries', () => {
  it('splits into rows of the column count, last row short', () => {
    const rows = chunkEntries([file('a'), file('b'), file('c')], 2);
    expect(rows.map((row) => row.map((entry) => entry.name))).toEqual([['a', 'b'], ['c']]);
  });
});

describe('tileCorner', () => {
  it('returns the same corner tileAt found for the index it reports', () => {
    for (const index of [0, 1, 4, 7, 11]) {
      const corner = tileCorner(index, lookup);
      expect(tileAt(corner.x, corner.y, lookup)).toEqual({ index, ...corner });
    }
  });

  it('resolves a corner for a tile scrolled above the viewport', () => {
    const scrolled = { ...lookup, scrollOffset: 300 };
    expect(tileCorner(0, scrolled).y).toBeLessThan(0);
  });

  it('is independent of where in the tile the pointer sat', () => {
    const hit = tileAt(250, 40, lookup);
    expect(tileCorner(hit.index, lookup)).toEqual({ x: hit.x, y: hit.y });
  });
});

describe('tileHitAt', () => {
  it('finds the tile a point is genuinely on', () => {
    const corner = tileCorner(5, lookup);
    expect(tileHitAt(corner.x + 10, corner.y + 10, lookup, 12)).toBe(5);
  });

  it('rejects the gutter between two tiles, where tileAt still names one', () => {
    const corner = tileCorner(0, lookup);
    // Just past the tile's right edge, inside the gutter before the next one.
    const inGutter = corner.x + lookup.tileWidth + 1;
    expect(tileAt(inGutter, corner.y + 10, lookup).index).toBe(0);
    expect(tileHitAt(inGutter, corner.y + 10, lookup, 12)).toBeNull();
  });

  it("rejects the grid's own padding", () => {
    expect(tileHitAt(2, 2, lookup, 12)).toBeNull();
  });

  it('rejects the empty run past the last entry', () => {
    const corner = tileCorner(5, lookup);
    expect(tileHitAt(corner.x + 10, corner.y + 10, lookup, 3)).toBeNull();
  });

  it('rejects the band below a row, where the row gap sits', () => {
    const corner = tileCorner(0, lookup);
    expect(tileHitAt(corner.x + 10, corner.y + TILE_HEIGHT + 2, lookup, 12)).toBeNull();
  });
});

describe('tilesInRect', () => {
  const metrics = { columns: lookup.columns, tileWidth: lookup.tileWidth };
  /** A rect spanning tiles `from`..`to` on one row, in the content frame. */
  const acrossRow = (row: number, fromColumn: number, toColumn: number) => {
    const start = tileCorner(row * lookup.columns + fromColumn, lookup);
    const end = tileCorner(row * lookup.columns + toColumn, lookup);
    return { height: 10, width: end.x + lookup.tileWidth - start.x, x: start.x, y: start.y + 10 };
  };

  it('takes every tile the box touches, in grid order', () => {
    expect(tilesInRect(acrossRow(0, 1, 3), metrics, 12)).toEqual([1, 2, 3]);
  });

  it('spans rows, so a tall box sweeps down one column', () => {
    // Exactly two strides: it reaches into row 1 and stops where row 2 begins.
    const covered = tilesInRect({ height: ROW_STRIDE * 2, width: 10, x: tileCorner(0, lookup).x + 5, y: 12 }, metrics, 12);
    expect(covered).toEqual([0, 4]);
  });

  it('takes nothing from a box that lives entirely in a gutter', () => {
    const corner = tileCorner(0, lookup);
    const gutter = { height: 10, width: 2, x: corner.x + lookup.tileWidth + 1, y: corner.y + 10 };
    expect(tilesInRect(gutter, metrics, 12)).toEqual([]);
  });

  it('stops at the last entry rather than at the last grid slot', () => {
    // Row 0 has four slots but only three entries behind them.
    expect(tilesInRect(acrossRow(0, 0, 3), metrics, 3)).toEqual([0, 1, 2]);
  });

  // A box dragged dead level has no height at all, and still has to sweep the
  // row it is drawn across — so a degenerate rect touches what it lies on rather
  // than nothing. (A box with no *extent* never gets here: the gesture does not
  // arm until the pointer has cleared the slop.)
  it('sweeps a row from a box dragged perfectly level', () => {
    const covered = tilesInRect(acrossRow(0, 0, 2), metrics, 12);
    expect(tilesInRect({ ...acrossRow(0, 0, 2), height: 0 }, metrics, 12)).toEqual(covered);
  });
});
