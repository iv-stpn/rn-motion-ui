// Public data model for <FileSystem>. Kept RN-free so the logic modules and
// their unit tests can import it without pulling in the render layer.
//
// Path model (after FileTree): every entry IS its path. Folder paths carry a
// trailing slash, file paths never do, and the empty string is the implicit
// root. Consumers may hand in a flat manifest of files only — missing folder
// prefixes are inferred by `buildFileSystemIndex`.

import type { ReactNode } from 'react';
import type { BreakpointValue } from '../../lib/breakpoints';

/** One entry in the list returned by `getContextMenuActions`. */
export type FileSystemContextMenuAction = {
  id: string;
  label: string;
  /** Optional leading icon — pass a `<IconName size={16} color={...} />` node. */
  icon?: ReactNode;
  /** Renders the label in the destructive color. */
  destructive?: boolean;
  disabled?: boolean;
};

/** The four Finder-style presentations. */
export type FileSystemView = 'icons' | 'list' | 'columns' | 'gallery';

export type FileSystemFolderItem = {
  kind: 'folder';
  /** Folder prefix, e.g. `'invoices/2026/'`. A trailing slash is added when missing. */
  path: string;
  name?: string;
  parentPath?: string;
  /** Set when children exist but are not in `items` yet; enables `loadChildren`. */
  hasChildren?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type FileSystemFileItem = {
  kind: 'file';
  /** Display/canonical path, e.g. `'invoices/2026/jan.pdf'`. */
  path: string;
  /** Original object key (S3/R2). Defaults to `path`. */
  key?: string;
  name?: string;
  parentPath?: string;
  contentType?: string;
  size?: number;
  createdAt?: string;
  updatedAt?: string;
  etag?: string;
  /** Optional if already public/presigned. Otherwise resolved via `getFileUrl`. */
  url?: string;
  /** Externally generated thumbnail. The component never rasterizes documents itself. */
  previewImageUrl?: string | null;
  /**
   * Externally generated page thumbnails (first entry is the cover). When a file
   * has more than one page, large thumbnails show a pager.
   */
  previewImageUrls?: string[] | null;
  /**
   * Total page count when it exceeds `previewImageUrls.length`; the pager loads
   * the remaining pages on demand via `loadPreviewImageUrl`.
   */
  previewPageCount?: number;
  /** Thumbnail aspect ratio (width / height). Defaults to a portrait page. */
  previewAspectRatio?: number;
  metadata?: Record<string, string>;
};

export type FileSystemItem = FileSystemFolderItem | FileSystemFileItem;

export type FileSystemLoadChildrenArgs = { path: string; cursor: string | null };

export type FileSystemLoadChildrenResult = { items: FileSystemItem[]; nextCursor?: string | null };

/** File classes the built-in viewer knows a layout for. */
export type FileSystemViewerKind = 'docx' | 'image' | 'pdf' | 'pptx' | 'xlsx';

export type FileSystemViewerArgs = { file: FileSystemFileItem; kind: FileSystemViewerKind | null; url: string | null };

/** Columns the entry list can be ordered by. */
export type FileSystemSortKey = 'createdAt' | 'kind' | 'name' | 'size' | 'updatedAt';

export type FileSystemSortDirection = 'asc' | 'desc';

export type FileSystemSortState = { direction: FileSystemSortDirection; key: FileSystemSortKey };

/** Filter facets offered by the toolbar's filter menu. */
export type FileSystemFilterType = 'dateCreated' | 'dateModified' | 'fileType';

export type FileSystemDateFilterType = Exclude<FileSystemFilterType, 'fileType'>;

export type FileSystemFilterOperator = 'after' | 'before' | 'in-range' | 'is' | 'is-any-of' | 'is-not' | 'not-in-range';

export type FileSystemFilter = { id: string; operator: FileSystemFilterOperator; type: FileSystemFilterType; value: string[] };

/** Coarse buckets the file-type checklist groups MIME types under. */
export type FileTypeFilterGroup = 'Documents' | 'Spreadsheets' | 'Images' | 'Code' | 'Text' | 'Archives & binary';

export type FileTypeFilterOption = {
  group: FileTypeFilterGroup;
  /** Sample file name so the option icon reuses the file-type resolver. */
  iconFileName: string;
  label: string;
  mime: string;
};

// ── Render-prop state shapes ───────────────────────────────────────────────
// Passed to renderHeader / renderFooter so consumers drive their own UI from
// the same state the built-in toolbar uses.

/** State snapshot passed to {@link FileSystemProps.renderHeader}. */
export type FileSystemHeaderState = {
  // Navigation
  canGoBack: boolean;
  canGoForward: boolean;
  /** Display name of the current folder (title at the root). */
  folderName: string;
  goBack: () => void;
  goForward: () => void;
  // View
  view: FileSystemView;
  setView: (view: FileSystemView) => void;
  // Search
  searchValue: string;
  setSearchValue: (value: string) => void;
  isSearchExpanded: boolean;
  setSearchExpanded: (expanded: boolean) => void;
  // Sort
  sort: FileSystemSortState;
  setSortKey: (key: FileSystemSortKey) => void;
  // Filters
  filters: FileSystemFilter[];
  fileTypeOptions: FileTypeFilterOption[];
  toggleFileType: (mime: string, checked: boolean) => void;
  selectDatePreset: (type: FileSystemDateFilterType, preset: string) => void;
  openCustomRange: (type: FileSystemDateFilterType) => void;
  clearFilters: () => void;
  // Responsive layout hints (derived from the measured root width)
  /** Width band the component has measured itself at. */
  layout: 'full' | 'compact' | 'minimal';
  /** `true` when root width is below the tablet breakpoint (768 px by default, see {@link FileSystemProps.breakpoints}); the built-in header switches from tabs to a dropdown at this point. */
  isCompact: boolean;
};

/** State snapshot passed to {@link FileSystemProps.renderFooter}. */
export type FileSystemStatusState = { count: number; isSearching: boolean; selectedName?: string };

// ── Responsive tiers ───────────────────────────────────────────────────────
// These are container widths, not window widths: the header adapts to the
// component's own measured width so it collapses inside a narrow parent too.
// That's why they don't come from the global breakpoint scale.

/** Container widths (px) at which the header sheds affordances. */
export type FileSystemBreakpoints = {
  /** Below this, the header drops to its sparsest layout. @default 360 */
  minimal?: number;
  /** Below this, the header uses the condensed layout. @default 560 */
  compact?: number;
  /** Below this, the four-tab view switcher collapses into a dropdown. @default 768 */
  tablet?: number;
};

export type ResolvedFileSystemBreakpoints = Required<FileSystemBreakpoints>;

export const defaultFileSystemBreakpoints: ResolvedFileSystemBreakpoints = { minimal: 360, compact: 560, tablet: 768 };

// ── Internal (resolved) entries ────────────────────────────────────────────
// The index fills in every optional identity field so the render layer never
// has to re-derive a name or a parent path.

export type FolderEntry = FileSystemFolderItem & { name: string; parentPath: string };

export type FileEntry = FileSystemFileItem & { key: string; name: string; parentPath: string };

export type FileSystemEntry = FolderEntry | FileEntry;

export type FileSystemIndex = {
  children: Map<string, FileSystemEntry[]>;
  files: Map<string, FileEntry>;
  folders: Map<string, FolderEntry>;
};

export type FileSystemProps = {
  /** Flat manifest. Folders are optional; missing prefixes are inferred from file paths. */
  items: FileSystemItem[];
  /**
   * Overrides the container widths at which the header collapses. Partial —
   * `{ tablet: 700 }` moves only that edge. See {@link FileSystemBreakpoints}.
   */
  breakpoints?: FileSystemBreakpoints;
  /**
   * Minimum *window* width at which entry context menus open as a
   * cursor-anchored panel instead of a bottom sheet. Separate from
   * {@link FileSystemProps.breakpoints} because those tiers measure the
   * component's own container, while the menu is a Modal clamped to the
   * viewport. A name from the default scale or a raw pixel number.
   *
   * @default 'md'
   */
  contextMenuWideBreakpoint?: BreakpointValue;
  /** Label for the root folder. */
  title?: string;
  defaultView?: FileSystemView;
  view?: FileSystemView;
  onViewChange?: (view: FileSystemView) => void;
  /** Folder prefix to open initially, e.g. `'invoices/'`. */
  defaultPath?: string;
  onSelectionChange?: (item: FileSystemItem | null) => void;
  /**
   * Called when a file is opened (double-click on web, second tap on native),
   * replacing the built-in behaviour. By default image files open in a viewer
   * modal, and everything else is delegated to `renderFileViewer` when provided.
   */
  onFileOpen?: (file: FileSystemFileItem, url: string | null) => void;
  /** Resolve a URL (e.g. presigned) for a file without one. */
  getFileUrl?: (file: FileSystemFileItem) => string | Promise<string>;
  /** Lazily fetch children for folders with `hasChildren` and no loaded entries. */
  loadChildren?: (args: FileSystemLoadChildrenArgs) => Promise<FileSystemLoadChildrenResult>;
  /** Custom preview node for files without `previewImageUrl`. */
  renderFilePreview?: (file: FileSystemFileItem) => ReactNode;
  /**
   * Document viewer body for the open-file modal and the gallery stage. The
   * component ships no PDF/DOCX/PPTX/XLSX renderers — return one here to make
   * those kinds viewable in place. Images are handled built-in.
   */
  renderFileViewer?: (args: FileSystemViewerArgs) => ReactNode;
  /**
   * Lazily render a page thumbnail beyond the eagerly provided
   * `previewImageUrls` (the pager calls this as pages come into view).
   */
  loadPreviewImageUrl?: (file: FileSystemFileItem, pageIndex: number) => Promise<string | null>;
  /**
   * Resolve the context-menu actions for an entry on right-click (web) or
   * long-press (native). Must return synchronously — the menu opens instantly
   * with no loading state. Return an empty array to show "No actions" copy.
   * Omit to disable context menus entirely.
   */
  getContextMenuActions?: (item: FileSystemItem) => FileSystemContextMenuAction[];
  /**
   * Called when the user picks an action from the context menu. May return a
   * promise; the menu closes immediately regardless of the promise outcome.
   */
  onContextMenuAction?: (action: FileSystemContextMenuAction, item: FileSystemItem) => void | Promise<void>;
  /**
   * Resolve context-menu actions for a right-click (web) or long-press (native)
   * on an empty area of the file browser — i.e. not on any entry. Omit to
   * disable the background context menu.
   */
  getBackgroundContextMenuActions?: () => FileSystemContextMenuAction[];
  /** Called when the user picks an action from the background context menu. */
  onBackgroundContextMenuAction?: (action: FileSystemContextMenuAction) => void | Promise<void>;
  /**
   * Enable drag-and-drop in the list and grid views. When `true`, entries can be
   * dragged onto folders to move them, and `onMove` fires on drop. A folder
   * cannot be dropped into itself or its own subtree. The columns and gallery
   * views accept the prop and ignore it.
   */
  draggable?: boolean;
  /**
   * Called after the user drops one or more entries onto a destination folder.
   * The component itself does not mutate `items` — update the prop in response.
   */
  onMove?: (event: FileSystemMoveEvent) => void;
  /** Fixed viewport height. Defaults to 480. */
  height?: number;
  // ── Headless slots ──────────────────────────────────────────────────────
  /**
   * Replace the built-in header toolbar with your own. Receives all the state
   * the default header uses so you can wire actions without duplicating logic.
   * When provided, `headerClassName` is ignored.
   */
  renderHeader?: (state: FileSystemHeaderState & { testID?: string }) => ReactNode;
  /**
   * Replace the built-in status-bar footer with your own. Receives the count /
   * search / selection state the default status bar displays.
   * When provided, `footerClassName` is ignored.
   */
  renderFooter?: (state: FileSystemStatusState & { testID?: string }) => ReactNode;
  /** Extra NativeWind classes merged onto the root container. */
  className?: string;
  /** Extra NativeWind classes merged onto the built-in header's root view. Ignored when `renderHeader` is provided. */
  headerClassName?: string;
  /** Extra NativeWind classes merged onto the file-area root view. */
  bodyClassName?: string;
  /** Extra NativeWind classes merged onto the built-in footer's root view. Ignored when `renderFooter` is provided. */
  footerClassName?: string;
  testID?: string;
};

/** Emitted by `onMove` when the user drops entries onto a destination folder. */
export type FileSystemMoveEvent = {
  /** Paths of the dragged entries. */
  sources: string[];
  /**
   * Destination folder path (trailing slash). Empty string `''` means the
   * implicit root — entries are moved to the top level.
   */
  destination: string;
};
