// Shared types for the FileTree component. Kept RN-free so the pure logic
// modules (paths / model / search / git / rename / drag / layout) can import
// them and be unit-tested in jsdom without pulling in react-native.

/** A tree entry is either a file or a directory. */
export type FileTreeKind = 'file' | 'directory';

/** How row selection behaves. */
export const FILE_TREE_SELECTION_MODES = { None: 'none', Single: 'single', Multiple: 'multiple' } as const;
export type FileTreeSelectionMode = (typeof FILE_TREE_SELECTION_MODES)[keyof typeof FILE_TREE_SELECTION_MODES];

/** Row height / scale presets. */
export type FileTreeDensity = 'compact' | 'default' | 'relaxed';

/**
 * Search filtering strategy:
 *  - `expand-matches`   — expand ancestors of matches, keep every row visible.
 *  - `collapse-non-matches` — collapse directories with no descendant match,
 *    keep every row present.
 *  - `hide-non-matches` — remove non-matching rows entirely (the only mode that
 *    changes the visible row COUNT).
 */
export type FileTreeSearchMode = 'expand-matches' | 'collapse-non-matches' | 'hide-non-matches';

/**
 * Initial expansion state applied when paths are (re)loaded:
 *  - `'closed'` — only top-level rows visible (default).
 *  - `'open'`   — every directory expanded.
 *  - a number   — expand directories up to that depth (0 = same as closed).
 */
export type FileTreeInitialExpansion = 'closed' | 'open' | number;

/** Single-letter git status codes (Pierre's lane letters). */
export type FileTreeGitStatusCode = 'A' | 'D' | 'M' | 'R' | 'U';

/**
 * Per-path git status input. `null` marks an ignored path (rendered dimmed, no
 * lane letter). A bare code applies to that exact path; directory rollups are
 * derived by the model.
 */
export type FileTreeGitStatus = FileTreeGitStatusCode | null;

/** Map of canonical path → git status. */
export type FileTreeGitStatusMap = Record<string, FileTreeGitStatus>;

/**
 * A projected, renderable row. This is what the model hands to the FlatList —
 * one entry per visible line, in DFS preorder.
 */
export type FileTreeVisibleRow = {
  /** Canonical path (directories end in `/`). Stable identity for this row. */
  path: string;
  /** Leaf name shown in the content lane (no trailing slash for dirs). */
  name: string;
  /** file | directory. */
  kind: FileTreeKind;
  /** Canonical paths of every ancestor, root-first (excludes this row). */
  ancestorPaths: string[];
  /** Structural depth in the ORIGINAL tree (before flattening). */
  depth: number;
  /** Indentation level actually rendered (after flattening collapses chains). */
  level: number;
  /** True when this directory has at least one child. */
  hasChildren: boolean;
  /** True when this directory is currently expanded. */
  isExpanded: boolean;
  /** True when this row absorbed a single-child dir chain via flattening. */
  isFlattened: boolean;
  /** The collapsed segment names when `isFlattened` (e.g. `['src','app']`). */
  flattenedSegments?: string[];
  /** Zero-based index within the visible list. */
  index: number;
  /** Zero-based position among siblings (for a11y `posInSet`). */
  posInSet: number;
  /** Sibling count (for a11y `setSize`). */
  setSize: number;
  /** True when this row holds keyboard/roving focus. */
  isFocused: boolean;
  /** True when this row is selected. */
  isSelected: boolean;
};
