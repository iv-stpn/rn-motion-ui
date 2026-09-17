// The columns view's pane geometry and its container-local row mapping. Data
// only, no React — extracted from `views/file-system-column.tsx` so the hit-test
// and marquee arithmetic can be unit-tested without pulling in the pane's
// drag/hover/marquee machinery.

/** Column pane width (px). Rows are uniform so `getItemLayout` stays exact. */
export const COLUMN_WIDTH = 240;
/** Row height (px) — the `getItemLayout` length. */
export const COLUMN_ROW_HEIGHT = 28;
/** Vertical gap between rows (px). */
export const COLUMN_ROW_GAP = 1;

/** The full vertical stride of one row (row + gap). */
export const COLUMN_ROW_STRIDE = COLUMN_ROW_HEIGHT + COLUMN_ROW_GAP;
/** Top/bottom padding inside the FlatList's content container (p-1.5 = 6 px). */
export const COLUMN_PADDING = 6;

/** A content-frame rectangle in pane-local coordinates (px). */
export type ColumnRect = { x: number; y: number; width: number; height: number };

/**
 * Content-frame rect → paths of every row it overlaps.
 *
 * The entries need nothing beyond a `path`, so the parameter is the structural
 * minimum rather than the full resolved `FileSystemEntry`.
 */
export function columnRowsInRect(rect: ColumnRect, entries: readonly { path: string }[]): readonly string[] {
  const top = rect.y - COLUMN_PADDING;
  const bottom = rect.y + rect.height - COLUMN_PADDING;
  const result: string[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    const rowTop = i * COLUMN_ROW_STRIDE;
    if (rowTop >= bottom) break;
    if (rowTop + COLUMN_ROW_HEIGHT > top) {
      const entry = entries[i];
      if (entry) result.push(entry.path);
    }
  }
  return result;
}

/** Container-local point → row index, or null for padding / gap / past-last-row. */
export function columnRowHitAt(_localX: number, localY: number, scrollOffset: number, rowCount: number): number | null {
  const contentY = localY + scrollOffset - COLUMN_PADDING;
  if (contentY < 0) return null;
  const rowIndex = Math.floor(contentY / COLUMN_ROW_STRIDE);
  if (rowIndex >= rowCount) return null;
  const intraRow = contentY - rowIndex * COLUMN_ROW_STRIDE;
  if (intraRow >= COLUMN_ROW_HEIGHT) return null; // inside the gap
  return rowIndex;
}
