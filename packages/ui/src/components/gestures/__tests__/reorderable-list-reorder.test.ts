// Pure-math tests for the reorderable list reorder logic.
// These test the insertion-position arithmetic in isolation — no React, no DOM.
import { describe, expect, it } from 'vitest';
import type { DragRect } from '../drag.types';
import { insertionPosition, isTopHalf, reorderItems } from '../ReorderableList/reorderable-list-reorder';

function rect(y: number, height: number): DragRect {
  return { height, width: 300, x: 0, y };
}

// Four items, each 50px tall, stacked vertically.
const RECTS = new Map<string, DragRect>([
  ['0', rect(0, 50)],
  ['1', rect(50, 50)],
  ['2', rect(100, 50)],
  ['3', rect(150, 50)],
]);

const KEYS = ['0', '1', '2', '3'];
const ITEMS = ['A', 'B', 'C', 'D'];

describe('isTopHalf', () => {
  it('returns true when the point is in the top half', () => {
    expect(isTopHalf(10, rect(0, 50))).toBe(true);
  });

  it('returns false when the point is in the bottom half', () => {
    expect(isTopHalf(40, rect(0, 50))).toBe(false);
  });

  it('returns false at the exact midpoint (bottom-half default)', () => {
    expect(isTopHalf(25, rect(0, 50))).toBe(false);
  });
});

describe('insertionPosition', () => {
  // ── The exact bug scenario ──────────────────────────────────────────
  // "move item 0 to the 3 position" — drag item at index 0 past item at
  // index 1 and 2, dropping so it lands at index 2 in the result (the
  // third item in a 0-indexed list).

  it('places dragged item after item 2 when pointer is in bottom half of item 2', () => {
    // Pointer at y=140 — bottom half of item '2' (rect 100–150, midpoint 125).
    const result = insertionPosition({
      keys: KEYS,
      draggedKey: '0',
      rects: RECTS,
      overKey: '2',
      pointY: 140,
    });

    // targetIndex = 2 + 1 = 3,   toIndex = 3 - 1 = 2
    expect(result).toEqual({ index: 2, before: false });
  });

  it('places dragged item before item 3 when pointer is in top half of item 3', () => {
    // Pointer at y=155 — top half of item '3' (rect 150–200, midpoint 175).
    const result = insertionPosition({
      keys: KEYS,
      draggedKey: '0',
      rects: RECTS,
      overKey: '3',
      pointY: 155,
    });

    // targetIndex = 3,   toIndex = 3 - 1 = 2
    expect(result).toEqual({ index: 2, before: true });
  });

  // ── Regression: what the user reports actually happens ──────────────
  // The item ends up at index 1 instead of 2. That would happen if the
  // overKey resolved to item '1' (bottom half) or item '2' (top half).

  it('places dragged item at index 1 when over item 1 in bottom half', () => {
    const result = insertionPosition({
      keys: KEYS,
      draggedKey: '0',
      rects: RECTS,
      overKey: '1',
      pointY: 80, // bottom half of item '1' (rect 50–100, midpoint 75)
    });

    // targetIndex = 1 + 1 = 2,   toIndex = 2 - 1 = 1
    expect(result).toEqual({ index: 1, before: false });
  });

  it('places dragged item at index 1 when over item 2 in top half', () => {
    const result = insertionPosition({
      keys: KEYS,
      draggedKey: '0',
      rects: RECTS,
      overKey: '2',
      pointY: 110, // top half of item '2' (rect 100–150, midpoint 125)
    });

    // targetIndex = 2,   toIndex = 2 - 1 = 1
    expect(result).toEqual({ index: 1, before: true });
  });

  // ── Backward drags ──────────────────────────────────────────────────
  it('handles dragging an item backward (to a lower index)', () => {
    // Drag item '3' (index 3) to before item '1' (index 1).
    const result = insertionPosition({
      keys: KEYS,
      draggedKey: '3',
      rects: RECTS,
      overKey: '1',
      pointY: 55, // top half of item '1' (rect 50–100, midpoint 75)
    });

    // targetIndex = 1,   toIndex = 1 (since targetIndex < draggedIndex)
    expect(result).toEqual({ index: 1, before: true });
    expect(reorderItems(ITEMS, 3, 1)).toEqual(['A', 'D', 'B', 'C']);
  });

  // ── No-op suppression ───────────────────────────────────────────────
  it('returns null when the item would land at its own position', () => {
    // Drag item '2' over itself (top half — before itself).
    const result = insertionPosition({
      keys: KEYS,
      draggedKey: '2',
      rects: RECTS,
      overKey: '2',
      pointY: 110, // top half of item '2'
    });

    // targetIndex = 2 === draggedIndex → null
    expect(result).toBeNull();
  });

  it('returns null when the item would land right after itself', () => {
    // Drag item '2' over itself (bottom half — after itself).
    const result = insertionPosition({
      keys: KEYS,
      draggedKey: '2',
      rects: RECTS,
      overKey: '2',
      pointY: 140, // bottom half of item '2'
    });

    // targetIndex = 3 === draggedIndex + 1 → null
    expect(result).toBeNull();
  });

  // ── Edge: insert at end ─────────────────────────────────────────────
  it('places item at the end when over last item in bottom half', () => {
    const result = insertionPosition({
      keys: KEYS,
      draggedKey: '0',
      rects: RECTS,
      overKey: '3',
      pointY: 180, // bottom half of item '3'
    });

    // targetIndex = 4,   toIndex = 4 - 1 = 3 (the last position)
    expect(result).toEqual({ index: 3, before: false });
    expect(reorderItems(ITEMS, 0, 3)).toEqual(['B', 'C', 'D', 'A']);
  });

  it('places item at the start when over first item in top half', () => {
    const result = insertionPosition({
      keys: KEYS,
      draggedKey: '3',
      rects: RECTS,
      overKey: '0',
      pointY: 10, // top half of item '0'
    });

    // targetIndex = 0,   toIndex = 0 (since targetIndex < draggedIndex)
    expect(result).toEqual({ index: 0, before: true });
    expect(reorderItems(ITEMS, 3, 0)).toEqual(['D', 'A', 'B', 'C']);
  });

  // ── Edge: unknown overKey ───────────────────────────────────────────
  it('returns null when overKey is not in the rects map', () => {
    const result = insertionPosition({
      keys: KEYS,
      draggedKey: '0',
      rects: RECTS,
      overKey: 'unknown',
      pointY: 50,
    });
    expect(result).toBeNull();
  });
});

describe('reorderItems', () => {
  it('moves an item from index 0 to index 2', () => {
    expect(reorderItems(['A', 'B', 'C', 'D'], 0, 2)).toEqual(['B', 'C', 'A', 'D']);
  });

  it('moves an item from index 0 to index 1', () => {
    expect(reorderItems(['A', 'B', 'C', 'D'], 0, 1)).toEqual(['B', 'A', 'C', 'D']);
  });

  it('moves an item from index 3 to index 1', () => {
    expect(reorderItems(['A', 'B', 'C', 'D'], 3, 1)).toEqual(['A', 'D', 'B', 'C']);
  });

  it('returns a copy when fromIndex equals toIndex', () => {
    expect(reorderItems(['A', 'B', 'C', 'D'], 1, 1)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('returns a copy when fromIndex is out of bounds', () => {
    expect(reorderItems(['A', 'B', 'C', 'D'], 10, 1)).toEqual(['A', 'B', 'C', 'D']);
  });
});
