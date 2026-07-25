// Pure layout math for the file tree. Rows are uniform height, so offsets are
// index * itemHeight. The interesting part is the sticky-header stack: as the
// list scrolls, the ancestor directory rows of the top visible row pin to the
// top. Pierre's original used a Math.random() jitter for the push transition;
// here that is replaced by a deterministic value derived from the scroll offset
// so renders are stable and snapshot-testable.

import type { FileTreeVisibleRow } from './file-tree.types';

export type FileTreeLayout = { itemHeight: number; totalHeight: number; rowCount: number };

/** Total scrollable height + per-row height for a uniform-height list. */
export function computeFileTreeLayout(rowCount: number, itemHeight: number): FileTreeLayout {
  return { itemHeight, totalHeight: rowCount * itemHeight, rowCount };
}

/** The y offset of a row by index in a uniform-height list. */
export function rowOffset(index: number, itemHeight: number): number {
  return index * itemHeight;
}

/** Index of the row occupying the top of the viewport at `scrollOffset`. */
export function topRowIndex(scrollOffset: number, itemHeight: number, rowCount: number): number {
  if (itemHeight <= 0 || rowCount === 0) return 0;
  const raw = Math.floor(scrollOffset / itemHeight);
  return Math.max(0, Math.min(rowCount - 1, raw));
}

export type StickyHeaders = {
  /** Ancestor directory rows to pin, shallow→deep (render top→bottom). */
  headers: FileTreeVisibleRow[];
  /**
   * How far (px, 0..itemHeight) the deepest sticky header is pushed up by the
   * next section arriving. Deterministic: derived purely from scrollOffset.
   */
  transition: number;
};

/**
 * Compute the sticky-header stack for a scroll position. The headers are the
 * ancestor directory rows of the top visible row (those whose path is in that
 * row's `ancestorPaths`). When a row belonging to a shallower-or-equal level
 * than the deepest sticky header scrolls up into the sticky zone, the deepest
 * header is pushed up by the overlap distance (clamped to one row height),
 * producing the classic "section header shove" without any randomness.
 */
export function computeStickyHeaders(rows: FileTreeVisibleRow[], scrollOffset: number, itemHeight: number): StickyHeaders {
  if (rows.length === 0 || itemHeight <= 0) return { headers: [], transition: 0 };

  const topIndex = topRowIndex(scrollOffset, itemHeight, rows.length);
  const topRow = rows[topIndex];
  if (!topRow) return { headers: [], transition: 0 };

  // Ancestor directory rows above (and including) the top row. We match by the
  // top row's ancestorPaths; those rows are guaranteed present and expanded
  // since the top row is visible beneath them.
  const ancestorSet = new Set(topRow.ancestorPaths);
  const headers: FileTreeVisibleRow[] = [];
  for (let i = 0; i <= topIndex; i += 1) {
    const row = rows[i];
    if (row && ancestorSet.has(row.path)) headers.push(row);
  }
  if (headers.length === 0) return { headers: [], transition: 0 };

  // Deterministic push: find the next row (below the top row) whose level is at
  // or above the deepest sticky header's slot — i.e. a new section boundary.
  const deepestSlot = headers.length - 1;
  const stackBottom = scrollOffset + headers.length * itemHeight;
  let transition = 0;
  for (let j = topIndex + 1; j < rows.length; j += 1) {
    const row = rows[j];
    if (row && row.level <= deepestSlot) {
      const boundaryTop = j * itemHeight;
      const overlap = stackBottom - boundaryTop;
      if (overlap > 0) transition = Math.min(overlap, itemHeight);
      break;
    }
  }

  return { headers, transition };
}

/**
 * The visible-row index under a pointer at `localY` (px from the top of the
 * scroll viewport) given the current `scrollOffset`. Clamped to a real row, or
 * `null` for an empty list. Uniform-height lists make this exact arithmetic —
 * no per-row measurement — which is what keeps drag hit-testing on the JS thread
 * cheap enough to run every gesture frame.
 */
export function rowIndexAtOffset(localY: number, scrollOffset: number, itemHeight: number, rowCount: number): number | null {
  if (rowCount === 0 || itemHeight <= 0) return null;
  const index = Math.floor((scrollOffset + Math.max(0, localY)) / itemHeight);
  return Math.max(0, Math.min(rowCount - 1, index));
}
