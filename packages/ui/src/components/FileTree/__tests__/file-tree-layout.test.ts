import { describe, expect, it } from 'vitest';
import type { FileTreeVisibleRow } from '../file-tree.types';
import { computeFileTreeLayout, computeStickyHeaders, rowIndexAtOffset, rowOffset, topRowIndex } from '../file-tree-layout';

function row(path: string, level: number, ancestorPaths: string[]): FileTreeVisibleRow {
  return {
    path,
    name: path,
    kind: path.endsWith('/') ? 'directory' : 'file',
    ancestorPaths,
    depth: level,
    level,
    hasChildren: path.endsWith('/'),
    isExpanded: path.endsWith('/'),
    isFlattened: false,
    index: 0,
    posInSet: 0,
    setSize: 1,
    isFocused: false,
    isSelected: false,
  };
}

describe('computeFileTreeLayout', () => {
  it('computes total height from row count and item height', () => {
    expect(computeFileTreeLayout(10, 30)).toEqual({ itemHeight: 30, totalHeight: 300, rowCount: 10 });
  });
});

describe('rowOffset', () => {
  it('is index times item height', () => {
    expect(rowOffset(0, 30)).toBe(0);
    expect(rowOffset(3, 30)).toBe(90);
  });
});

describe('topRowIndex', () => {
  it('floors the scroll offset into a row index', () => {
    expect(topRowIndex(0, 30, 10)).toBe(0);
    expect(topRowIndex(59, 30, 10)).toBe(1);
    expect(topRowIndex(60, 30, 10)).toBe(2);
  });

  it('clamps to the last row and handles empty lists', () => {
    expect(topRowIndex(9999, 30, 10)).toBe(9);
    expect(topRowIndex(50, 30, 0)).toBe(0);
    expect(topRowIndex(50, 0, 10)).toBe(0);
  });
});

describe('computeStickyHeaders', () => {
  // src/ > src/app/ > x.ts, then a top-level other.ts sibling.
  const rows = [
    row('src/', 0, []),
    row('src/app/', 1, ['src/']),
    row('src/app/x.ts', 2, ['src/', 'src/app/']),
    row('other.ts', 0, []),
  ];

  it('pins the ancestor directory rows of the top visible row', () => {
    // Scroll so src/app/x.ts is the top row.
    const { headers } = computeStickyHeaders(rows, 60, 30);
    expect(headers.map((h) => h.path)).toEqual(['src/', 'src/app/']);
  });

  it('has no headers when the top row is a root row', () => {
    expect(computeStickyHeaders(rows, 0, 30).headers).toEqual([]);
  });

  it('derives a deterministic push transition from the scroll overlap', () => {
    // stackBottom = 75 + 2*30 = 135; other.ts boundary at 3*30 = 90 → overlap 45,
    // clamped to itemHeight 30.
    expect(computeStickyHeaders(rows, 75, 30).transition).toBe(30);
  });

  it('returns an empty stack for empty rows or a non-positive item height', () => {
    expect(computeStickyHeaders([], 0, 30)).toEqual({ headers: [], transition: 0 });
    expect(computeStickyHeaders(rows, 60, 0)).toEqual({ headers: [], transition: 0 });
  });
});

describe('rowIndexAtOffset', () => {
  it('maps a pointer within the viewport to the row beneath it', () => {
    // scrollOffset 0: localY 0..29 → row 0, 30..59 → row 1.
    expect(rowIndexAtOffset(0, 0, 30, 10)).toBe(0);
    expect(rowIndexAtOffset(29, 0, 30, 10)).toBe(0);
    expect(rowIndexAtOffset(30, 0, 30, 10)).toBe(1);
  });

  it('accounts for the current scroll offset', () => {
    // Scrolled 60px: a pointer at the top of the viewport sits over row 2.
    expect(rowIndexAtOffset(0, 60, 30, 10)).toBe(2);
    expect(rowIndexAtOffset(45, 60, 30, 10)).toBe(3);
  });

  it('clamps a pointer past the last row and treats negative Y as the top', () => {
    expect(rowIndexAtOffset(9999, 0, 30, 10)).toBe(9);
    expect(rowIndexAtOffset(-40, 60, 30, 10)).toBe(2);
  });

  it('returns null for an empty list or a non-positive item height', () => {
    expect(rowIndexAtOffset(50, 0, 30, 0)).toBeNull();
    expect(rowIndexAtOffset(50, 0, 0, 10)).toBeNull();
  });
});
