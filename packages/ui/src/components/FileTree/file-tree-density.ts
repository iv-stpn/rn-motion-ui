/** biome-ignore-all lint/style/useExportsLast: exports and defines multiple utils */
// Density presets: resolve a density name into the concrete pixel metrics the
// row renderer and the virtualizer need. Pure + RN-free.
//
// After @pierre/trees: compact 24px rows, default 30px, relaxed 36px, with the
// indent/icon/font scaled by a per-density multiplier.

import type { FileTreeDensity } from './file-tree.types';

/** Concrete metrics for one density. All values are in px unless noted. */
export type FileTreeDensityMetrics = {
  /** Fixed row height (drives getItemLayout + virtualization math). */
  itemHeight: number;
  /** Horizontal indent added per rendered level. */
  indentPerLevel: number;
  /** Leading icon (file/folder) square size. */
  iconSize: number;
  /** Chevron (expand/collapse) square size. */
  chevronSize: number;
  /** Row label font size. */
  fontSize: number;
  /** Git-status letter font size. */
  statusFontSize: number;
  /** Horizontal gap between the icon and the label. */
  gap: number;
};

/** Default row height (matches Pierre's FILE_TREE_DEFAULT_ITEM_HEIGHT). */
export const FILE_TREE_DEFAULT_ITEM_HEIGHT = 30;

/** How many extra rows to render above/below the viewport while scrolling. */
export const FILE_TREE_OVERSCAN = 10;

const PRESETS: Record<FileTreeDensity, FileTreeDensityMetrics> = {
  compact: { itemHeight: 24, indentPerLevel: 12, iconSize: 14, chevronSize: 14, fontSize: 12, statusFontSize: 10, gap: 6 },
  default: { itemHeight: 30, indentPerLevel: 16, iconSize: 16, chevronSize: 16, fontSize: 14, statusFontSize: 11, gap: 8 },
  relaxed: { itemHeight: 36, indentPerLevel: 20, iconSize: 18, chevronSize: 18, fontSize: 15, statusFontSize: 12, gap: 10 },
};

/** Resolve a density name into its concrete metrics. */
export function resolveDensityMetrics(density: FileTreeDensity): FileTreeDensityMetrics {
  return PRESETS[density];
}

/** Left padding (px) for a row rendered at `level` under the given density. */
export function indentForLevel(level: number, metrics: FileTreeDensityMetrics): number {
  return Math.max(0, level) * metrics.indentPerLevel;
}
