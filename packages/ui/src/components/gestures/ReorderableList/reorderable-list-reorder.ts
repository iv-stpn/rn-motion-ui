// Pure reorder arithmetic for the ReorderableList — no React, no react-native.
//
// What lives here: computing where a dragged item would land, and applying that
// move to an array. What lives in the component: the drag state, the zone rect
// cache, and the subscription wiring. Split for the reason every pure module in
// this directory is split: vitest cannot import anything that reaches
// react-native.

import type { DragRect } from '../drag.types';

/**
 * Whether a pointer over `rect` is in the top half — which means "insert before
 * this item" — rather than the bottom, which means after.
 *
 * The midpoint split is the simplest rule that works: it matches every platform's
 * list reorder convention, needs no extra configuration, and a user sees the
 * insertion line jump to where they meant as their finger crosses the centre.
 */
export function isTopHalf(pointY: number, rect: DragRect): boolean {
  return pointY < rect.y + rect.height / 2;
}

/**
 * The visual index where the insertion indicator should appear, or `null` when
 * the landing spot is a no-op (the dragged item over its own position).
 *
 * The indicator is shown *before* `overKey` when the pointer is in the top half
 * (`insertBefore`), or *after* it otherwise. The result is expressed against the
 * original key order — the same one `insertionPosition` reasons about.
 */
export function computeIndicatorIndex(
  draggedKey: string | null,
  overKey: string | null,
  insertBefore: boolean,
  keys: readonly string[],
): number | null {
  if (draggedKey === null || overKey === null) return null;

  const overIdx = keys.indexOf(overKey);
  if (overIdx === -1) return null;

  const visualIdx = insertBefore ? overIdx : overIdx + 1;
  const draggedIdx = keys.indexOf(draggedKey);

  // Suppress when the visual insertion would be a no-op (same position).
  if (visualIdx === draggedIdx || visualIdx === draggedIdx + 1) return null;
  return visualIdx;
}

export type InsertionParams = {
  /** Every item key in display order, before the drag. */
  keys: readonly string[];
  /** The item being dragged — its key, and therefore its position. */
  draggedKey: string;
  /** Measured window rects, keyed by item key. */
  rects: ReadonlyMap<string, DragRect>;
  /** Which item's zone the pointer is over. */
  overKey: string;
  /** Pointer Y in window coordinates. */
  pointY: number;
};

export type InsertionResult = {
  /** The index the dragged item should move to. */
  index: number;
  /** True when the insertion indicator goes above the over item. */
  before: boolean;
};

/**
 * Where in the list the dragged item would land, given the pointer's Y position
 * and the zone it is over.
 *
 * Returns `null` when the insertion would be a no-op — the dragged item over
 * itself, at its own position — or when the over-key is not in the rects map.
 */
export function insertionPosition(params: InsertionParams): InsertionResult | null {
  const { keys, draggedKey, rects, overKey, pointY } = params;

  const overRect = rects.get(overKey);
  if (overRect === undefined) return null;

  const draggedIndex = keys.indexOf(draggedKey);
  if (draggedIndex === -1) return null;

  const overIndex = keys.indexOf(overKey);
  if (overIndex === -1) return null;

  const before = isTopHalf(pointY, overRect);

  // The target index in the list *with the dragged item still in it*.
  // After removal, indices shift — the caller applies `toIndex`.
  const targetIndex = before ? overIndex : overIndex + 1;

  // If dropping before or after itself in the same position, it is a no-op.
  // When the dragged item is at index 3 and we insert at index 3 (before) or
  // index 4 (after), the item stays where it was.
  if (targetIndex === draggedIndex || targetIndex === draggedIndex + 1) return null;

  // Convert to the index in the array *after* removal.
  const toIndex = targetIndex > draggedIndex ? targetIndex - 1 : targetIndex;

  return { index: toIndex, before };
}

/**
 * Move one element in an array from `fromIndex` to `toIndex`.
 *
 * Returns a new array; does not mutate the input.
 */
export function reorderItems<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  const result = [...items];
  const [moved] = result.splice(fromIndex, 1);
  if (moved === undefined) return [...items];
  result.splice(toIndex, 0, moved);
  return result;
}
