// Public props for <FileTree>. Declarative-first (paths + controlled state +
// callbacks, matching <Table>'s shape) with an escape hatch: pass a `model`
// (a FileTreeController from useFileTree) to drive the tree imperatively.
// Kept RN-light — only style/callback types — so it can be imported anywhere.

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type {
  FileTreeDensity,
  FileTreeGitStatusMap,
  FileTreeInitialExpansion,
  FileTreeSearchMode,
  FileTreeSelectionMode,
  FileTreeVisibleRow,
} from './file-tree.types';
import type { FileTreeController } from './file-tree-controller';

/** Context passed to a right-click / long-press context-menu request. */
export type FileTreeContextMenuEvent = {
  path: string;
  /** Every currently-selected path (includes `path` when it is selected). */
  selectedPaths: string[];
  /** Screen coordinates of the trigger, when available (web pointer). */
  x?: number;
  y?: number;
};

/** Payload emitted when a drag-and-drop move commits. */
export type FileTreeMoveEvent = {
  /** The dragged source paths (directories carry their descendants). */
  sources: string[];
  /** Destination directory the sources landed in ('' = top level). */
  destination: string;
  /** old → new canonical path for every moved entry and descendant. */
  remap: Record<string, string>;
  /** The full canonical path set after the move. */
  paths: string[];
};

/** Payload emitted when an inline rename commits. */
export type FileTreeRenameEvent = {
  /** The renamed entry's original canonical path. */
  path: string;
  /** The renamed entry's new canonical path. */
  newPath: string;
  /** old → new canonical path for the entry and any descendants. */
  remap: Record<string, string>;
  /** The full canonical path set after the rename. */
  paths: string[];
};

export type FileTreeProps = {
  // ── Data ───────────────────────────────────────────────────────────────────
  /**
   * Canonical-ish path list. Directories may be given explicitly (trailing `/`)
   * or inferred from file paths. Ignored when `model` is provided.
   */
  paths?: string[];
  /** Per-path git status. `null` marks an ignored (dimmed) path. */
  gitStatus?: FileTreeGitStatusMap;

  // ── Escape hatch ─────────────────────────────────────────────────────────────
  /**
   * Drive the tree with a controller from `useFileTree()`. When set, `paths`,
   * `gitStatus`, and the controllable state props below are ignored — the model
   * owns all state. Selection/expansion callbacks still fire.
   */
  model?: FileTreeController;

  // ── Selection (controllable) ─────────────────────────────────────────────────
  selectionMode?: FileTreeSelectionMode;
  /** Controlled selection. Provide with `onSelectionChange` for a controlled tree. */
  selectedPaths?: string[];
  defaultSelectedPaths?: string[];
  onSelectionChange?: (paths: string[]) => void;

  // ── Expansion (controllable) ─────────────────────────────────────────────────
  /** Controlled expanded-directory set. */
  expandedPaths?: string[];
  defaultExpandedPaths?: string[];
  onExpandedChange?: (paths: string[]) => void;
  /** Expansion applied on first load. Defaults to `'closed'`. */
  initialExpansion?: FileTreeInitialExpansion;

  // ── Search (controllable) ─────────────────────────────────────────────────────
  searchQuery?: string;
  defaultSearchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  /** Filtering strategy. Defaults to `'expand-matches'`. */
  searchMode?: FileTreeSearchMode;
  /** Render the built-in search input above the tree. Defaults to `false`. */
  showSearch?: boolean;

  // ── Presentation ───────────────────────────────────────────────────────────
  /** Row height / scale preset. Defaults to `'default'`. */
  density?: FileTreeDensity;
  /** Collapse single-child directory chains into one row. Defaults to `true`. */
  flattenEmptyDirectories?: boolean;
  /** Pin ancestor directory rows to the top while scrolling. Defaults to `true`. */
  stickyHeaders?: boolean;
  /** Show the indentation guide lines. Defaults to `true`. */
  showIndentGuides?: boolean;
  /** Show file-type / folder icons. Defaults to `true`. */
  showIcons?: boolean;

  // ── Interaction ───────────────────────────────────────────────────────────
  /** Allow long-press → drag to move entries. Defaults to `false`. */
  draggable?: boolean;
  /** Allow inline rename (double-tap on web, long-press action on touch). Defaults to `false`. */
  renamable?: boolean;
  onMove?: (event: FileTreeMoveEvent) => void;
  onRename?: (event: FileTreeRenameEvent) => void;
  onActivate?: (row: FileTreeVisibleRow) => void;
  onContextMenu?: (event: FileTreeContextMenuEvent) => void;

  // ── Layout ───────────────────────────────────────────────────────────────
  /** Fixed viewport height for the scroll container. Defaults to `360`. */
  height?: number;
  /** Rendered above the tree when the path set is empty. */
  emptyState?: ReactNode;

  // ── Styling ───────────────────────────────────────────────────────────────
  /** NativeWind classes merged onto the outer container (last-wins). */
  className?: string;
  /** NativeWind classes merged onto every row. */
  rowClassName?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};
