// Column packing for FileSystemMobileGridView.
//
// Pure math, no React or RN imports, so the geometry can be unit-tested away
// from the view. The grid itself wraps with flexbox rather than laying tiles at
// computed positions — the only number it needs is the tile width, and every
// tile has to agree on it or the last column in a row wraps early.

/** Content padding around the grid, on all four sides. */
export const GRID_PADDING = 12;
/** Horizontal gap between columns. */
export const GRID_GAP = 8;
/** Vertical gap between rows. */
export const GRID_ROW_GAP = 12;
/**
 * The narrowest a tile may be packed — the `auto-fill` floor.
 *
 * Tuned so every phone stays two across, which is the layout the touch view was
 * drawn for: the narrowest viewport still shipping (320pt) lands at 144pt tiles
 * and the widest (430pt) at 199pt. A tablet or a wide pane packs past two from
 * ~510pt on, reaching five columns at 768pt. Below the floor the grid drops to a
 * single column rather than squeezing a tile past what a two-line name can hold
 * beside its kebab.
 */
export const MIN_TILE_WIDTH = 140;

export type MobileGridMetrics = { columns: number; tileWidth: number };

/**
 * Column count and tile width for a measured container width.
 *
 * Columns are packed at {@link MIN_TILE_WIDTH} or wider and then share out the
 * slack, so tiles grow with the container instead of the count jumping and
 * leaving a ragged margin. Width 0 (before the first layout) yields a 0 tile
 * width, which the view reads as "not measured yet".
 */
export function mobileGridMetrics(width: number): MobileGridMetrics {
  const available = Math.max(0, width - GRID_PADDING * 2);
  // A row of n tiles spends n-1 gaps, so lend the row one phantom trailing gap
  // and the fit becomes a plain count of tile+gap strides.
  const columns = Math.max(1, Math.floor((available + GRID_GAP) / (MIN_TILE_WIDTH + GRID_GAP)));
  return { columns, tileWidth: Math.max(0, Math.floor((available - GRID_GAP * (columns - 1)) / columns)) };
}
