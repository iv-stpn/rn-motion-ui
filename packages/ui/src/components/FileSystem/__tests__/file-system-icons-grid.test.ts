import { describe, expect, it } from 'vitest';
import type { FileSystemEntry } from '../file-system.types';
import { chunkEntries, gridMetrics, tileAt, tileCorner } from '../file-system-icons-grid';

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
