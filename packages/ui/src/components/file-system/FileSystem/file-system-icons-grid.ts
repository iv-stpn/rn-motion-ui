// Grid geometry for FileSystemIconsView.
//
// Pure math, no React or RN imports: the view lays the tiles out from these
// constants and the drag session resolves pointer positions with them, so the
// two must agree exactly — one row-stride of drift and the tile the pointer
// looks to be over is not the one that commits.

/** The grid's content-container padding (p-3), on all four sides. */
export const GRID_PADDING = 12;
/** Columns are packed at this width or wider — the `auto-fill` floor. */
export const MIN_TILE_WIDTH = 104;
export const TILE_GAP = 4;
export const ROW_GAP = 12;
/** Fixed tile height: a glyph box plus a reserved two-line label. */
export const TILE_HEIGHT = 102;
/** A row occupies its tile plus the gap below it, so every row shares a stride. */
export const ROW_STRIDE = TILE_HEIGHT + ROW_GAP;

// The glyph box — the framed square at the top of a tile that holds the folder
// glyph or the file thumbnail. It is the tile's *state surface*: hover tints it,
// a drop outlines it, and selection fills it. Its size lives here with the rest
// of the geometry because the sliding hover highlight is positioned from these
// numbers while the tile paints itself from them, and a highlight one pixel off
// its box reads as a misprint.
export const GLYPH_BOX_WIDTH = 80;
export const GLYPH_BOX_HEIGHT = 64;

export type GridMetrics = { columns: number; tileWidth: number };

/** Column count and tile width for a measured viewport width. */
export function gridMetrics(width: number): GridMetrics {
  const available = Math.max(0, width - GRID_PADDING * 2);
  const columns = Math.max(1, Math.floor((available + TILE_GAP) / (MIN_TILE_WIDTH + TILE_GAP)));
  return { columns, tileWidth: Math.floor((available - TILE_GAP * (columns - 1)) / columns) };
}

/** Split a flat entry list into fixed-width rows the FlatList can window. */
export function chunkEntries<T>(entries: T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < entries.length; i += columns) rows.push(entries.slice(i, i + columns));
  return rows;
}

/** The grid state a pointer position has to be read against. */
export type TileLookup = GridMetrics & { scrollOffset: number };

export type TileHit = {
  /** Flat index into the entry list. */
  index: number;
  /** The tile's own top-left corner, container-local (same frame as the input). */
  x: number;
  y: number;
};

/**
 * Resolve a container-local point to the tile under it.
 *
 * The corner comes back alongside the index because the drag ghost is anchored
 * to it: holding the ghost at a fixed offset from the tile's origin keeps the
 * grabbed spot of the tile under the cursor for the whole drag, the way a desktop
 * file manager does. `scrollOffset` converts between the two frames — the index
 * is a content-space question, the corner a container-space answer.
 */
export function tileAt(localX: number, localY: number, { columns, scrollOffset, tileWidth }: TileLookup): TileHit {
  const stride = tileWidth + TILE_GAP;
  const col = Math.max(0, Math.min(Math.floor((localX - GRID_PADDING) / stride), columns - 1));
  const row = Math.max(0, Math.floor((localY + scrollOffset - GRID_PADDING) / ROW_STRIDE));
  return {
    index: row * columns + col,
    x: GRID_PADDING + col * stride,
    y: GRID_PADDING + row * ROW_STRIDE - scrollOffset,
  };
}

/**
 * The tile a point is genuinely *on*, or `null` for the grid's padding, the gaps
 * between tiles, and the empty run after the last entry.
 *
 * The stricter counterpart to {@link tileAt}, which clamps to the nearest tile
 * because a drop has to commit somewhere. Three callers want the strict answer
 * instead: the hover highlight (no glow in a gap), the drag (a lift starts on a
 * tile or not at all), and the selection box (which may only begin off a tile).
 * The last two must agree exactly, or a press in a gap would start both.
 */
export function tileHitAt(localX: number, localY: number, lookup: TileLookup, entryCount: number): number | null {
  const hit = tileAt(localX, localY, lookup);
  if (hit.index >= entryCount) return null;
  const inside = localX >= hit.x && localX < hit.x + lookup.tileWidth && localY >= hit.y && localY < hit.y + TILE_HEIGHT;
  return inside ? hit.index : null;
}

/** A rectangle in the grid's *content* frame — scroll already folded into `y`. */
export type TileRect = { x: number; y: number; width: number; height: number };

/**
 * Every tile a rectangle touches, in grid order.
 *
 * Content-frame in, indexes out: the caller folds the scroll offset into the
 * rect once, so a selection box started before a wheel-scroll keeps covering the
 * tiles it was dragged over rather than sliding with the viewport.
 *
 * Intersection is against the tile's whole box rather than its glyph box — a box
 * dragged through the label of a tile has visibly touched it, and a hit test
 * that disagreed with what the pointer swept over would read as a dead zone.
 */
export function tilesInRect(rect: TileRect, { columns, tileWidth }: GridMetrics, entryCount: number): number[] {
  const stride = tileWidth + TILE_GAP;
  const left = rect.x - GRID_PADDING;
  const top = rect.y - GRID_PADDING;
  const right = left + rect.width;
  const bottom = top + rect.height;

  // A tile spans [n*stride, n*stride + tileWidth); the gap after it is dead
  // space, so a column is touched when the rect reaches its box, not its stride.
  const firstColumn = Math.max(0, Math.floor(left / stride));
  const lastColumn = Math.min(columns - 1, Math.floor(right / stride));
  const firstRow = Math.max(0, Math.floor(top / ROW_STRIDE));
  const lastRow = Math.floor(bottom / ROW_STRIDE);

  const overlaps = (start: number, extent: number, from: number, to: number) => start + extent > from && start < to;

  const indexes: number[] = [];
  for (let row = firstRow; row <= lastRow; row += 1) {
    if (overlaps(row * ROW_STRIDE, TILE_HEIGHT, top, bottom))
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        const index = row * columns + column;
        if (index < entryCount && overlaps(column * stride, tileWidth, left, right)) indexes.push(index);
      }
  }
  return indexes;
}

/**
 * `tileAt` run backwards: the corner of a tile named by index rather than found
 * by position. While a drag is live the hover highlight is placed from the drag's
 * target index rather than from the pointer, so the two marks cannot disagree —
 * the pointer may sit in a gap, in the padding, or past the last tile while the
 * target is still a real folder.
 */
export function tileCorner(index: number, { columns, scrollOffset, tileWidth }: TileLookup): Omit<TileHit, 'index'> {
  const col = index % columns;
  const row = Math.floor(index / columns);
  return { x: GRID_PADDING + col * (tileWidth + TILE_GAP), y: GRID_PADDING + row * ROW_STRIDE - scrollOffset };
}

/**
 * The glyph box of the tile at `index`, container-local. The tile centres its
 * glyph box horizontally and pins it to its top, so this is `tileCorner` shifted
 * by half the slack — the rect the hover highlight fills and the drop outline
 * frames. Derived rather than measured: the highlight is a single node sliding
 * between tiles, so it never gets a layout callback from the box it is marking.
 */
export function glyphBoxCorner(index: number, lookup: TileLookup): Omit<TileHit, 'index'> {
  const { x, y } = tileCorner(index, lookup);
  return { x: x + Math.round((lookup.tileWidth - GLYPH_BOX_WIDTH) / 2), y };
}
