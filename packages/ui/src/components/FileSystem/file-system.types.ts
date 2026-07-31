/** biome-ignore-all lint/style/noExcessiveLinesPerFile: one public data model — the props type and the shapes its callbacks pass belong in one place */
// Public data model for <FileSystem>. Kept RN-free so the logic modules and
// their unit tests can import it without pulling in the render layer.
//
// Path model (after FileTree): every entry IS its path. Folder paths carry a
// trailing slash, file paths never do, and the empty string is the implicit
// root. Consumers may hand in a flat manifest of files only — missing folder
// prefixes are inferred by `buildFileSystemIndex`.

import type { ReactNode } from 'react';
import type { BreakpointValue } from '../../lib/breakpoints';
import type { FileSystemSelectionMode } from './file-system-selection';

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
export type FileSystemStatusState = {
  count: number;
  isSearching: boolean;
  /** Name of the lead entry — the sole selection, or the last one added to it. */
  selectedName?: string;
  /** How many entries are selected. `0` or `1` unless `selectionMode` is `'multiple'`. */
  selectedCount: number;
  /** Empties the selection — the way out of a multi-selection on touch. */
  clearSelection: () => void;
};

/**
 * State snapshot passed to {@link FileSystemProps.renderBody}. Unlike the header
 * and footer slots this one wraps rather than replaces: `content` is the file
 * area the component would have rendered on its own, so returning it unchanged
 * is a no-op and returning it inside your own tree decorates it.
 */
export type FileSystemBodyState = {
  /** The active view, or the empty/loading placeholder standing in for it. */
  content: ReactNode;
  /** Folder prefix currently open (`''` at the root). */
  currentPath: string;
  /** Entries of the current folder, sorted and filtered — the search hits while searching. */
  entries: FileSystemEntry[];
  view: FileSystemView;
  /** The lead entry — see {@link FileSystemProps.onSelectionChange}. */
  selectedEntry: FileSystemEntry | null;
  /** Every selected entry, in the order they were added. */
  selectedEntries: FileSystemEntry[];
  searchValue: string;
  isSearching: boolean;
  hasActiveFilters: boolean;
  /** `true` while the current folder's children are being fetched. */
  isLoadingCurrentFolder: boolean;
  /**
   * `true` when the current folder has no entries to show. The columns view
   * still renders its panes in that case, so this does not always mean `content`
   * is the placeholder.
   */
  isEmpty: boolean;
};

/** Why the file area has a placeholder in it instead of entries. */
export type FileSystemEmptyStateReason =
  /** The current folder's children are still being fetched. */
  | 'loading'
  /** The folder itself holds nothing. */
  | 'empty-folder'
  /** A search is running and nothing matched the query. */
  | 'no-search-results'
  /** Filters are active and nothing matched them. */
  | 'no-filter-matches';

/** Args passed to {@link FileSystemProps.renderEmptyState}. */
export type FileSystemEmptyStateArgs = {
  reason: FileSystemEmptyStateReason;
  /** The copy the built-in placeholder would have shown, ready to reuse. */
  label: string;
  /** Folder prefix currently open (`''` at the root). */
  currentPath: string;
  /** Display name of the current folder (the `title` prop at the root). */
  folderName: string;
  view: FileSystemView;
  /** Raw search input rather than the normalized query, so a message can quote what was typed. */
  searchValue: string;
  isSearching: boolean;
  hasActiveFilters: boolean;
};

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
  /**
   * How many entries can be selected at once.
   *
   * `'multiple'` turns on the gestures a file browser is expected to have:
   *
   * - **Ctrl-click** (Cmd-click on macOS), or a **long-press** on touch: toggle
   *   the entry under the pointer in or out of the selection.
   * - **Shift-click**: take the contiguous run from the anchor — the last entry
   *   picked without Shift — to the entry pressed, in the order the surface you
   *   pressed lays its entries out. Shift-clicking around grows and shrinks one
   *   run rather than accumulating; hold Ctrl/Cmd as well to add the run to
   *   what is already selected.
   * - **A selection box** dragged across empty space in the grid view, web only.
   *   Everything the box touches is selected live as it is drawn; hold Ctrl/Cmd
   *   as you start it to add to the selection instead of replacing it. The other
   *   three views have no empty space to start one from.
   *
   * A plain press still replaces the selection, and a press on the background
   * still clears it.
   *
   * Two consequences worth knowing before you switch it on:
   *
   * - Long-press is already the entry context menu's trigger on touch, and
   *   multi-selection takes it over. With `getContextMenuActions` the menu still
   *   opens on right-click on web, but on touch it becomes unreachable — so pick
   *   one, or surface those actions elsewhere in your UI.
   * - With `draggable`, a hold on native starts a drag (at 300 ms) before a long
   *   press resolves (at 500 ms), so the toggle gesture is effectively web-only
   *   in the list and icons views.
   *
   * @default 'single'
   */
  selectionMode?: FileSystemSelectionMode;
  /**
   * Called with the lead entry — the one a single-selection surface follows.
   * Under `selectionMode="multiple"` that is the entry most recently added to
   * the selection; use {@link FileSystemProps.onSelectedItemsChange} for the
   * whole set.
   */
  onSelectionChange?: (item: FileSystemItem | null) => void;
  /**
   * Called with the entire selection whenever it changes, in the order the
   * entries were added. Fires with `[]` when the selection is cleared. Only
   * interesting under `selectionMode="multiple"` — in `single` mode it mirrors
   * {@link FileSystemProps.onSelectionChange} one item at a time.
   */
  onSelectedItemsChange?: (items: FileSystemItem[]) => void;
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
   *
   * Dragging an entry that belongs to a multi-selection moves the whole
   * selection, so `sources` can hold more than the entry under the pointer.
   * Members the drop would not be a move for — the destination itself, entries
   * already in it, a folder dropped into its own subtree — are dropped from the
   * list, and nothing fires when that leaves it empty.
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
  /**
   * Wrap the file area instead of replacing it. Receives the default content —
   * the active view or its empty/loading placeholder — as `state.content`, plus
   * the state that produced it, so an overlay, a drop hint or a sidebar can sit
   * alongside the views without reimplementing them. Return `state.content`
   * as-is to opt out for a given state.
   *
   * The wrapper renders inside the file-area node, so `bodyClassName` still
   * applies. Give the returned tree `flex-1` (or `size-full`) if it should fill
   * the area the way the built-in views do.
   *
   * Called as a plain function, not rendered as a component, so that an inline
   * arrow doesn't remount the active view on every render. Don't call hooks
   * directly in it — put them in a component you render inside the returned
   * tree.
   *
   * ```tsx
   * renderBody={({ content, isEmpty }) => (
   *   <View className="flex-1">
   *     {content}
   *     {isEmpty ? null : <UploadOverlay />}
   *   </View>
   * )}
   * ```
   */
  renderBody?: (state: FileSystemBodyState & { testID?: string }) => ReactNode;
  /**
   * Replace the placeholder that stands in for the file area when there is
   * nothing to show — an empty folder, a search with no hits, filters that match
   * nothing, or a folder still loading. `args.reason` says which, and
   * `args.label` carries the copy the default would have used.
   *
   * Return `undefined` to keep the built-in placeholder for that state — handy
   * for customizing the empty folder while leaving the loading spinner alone.
   * Return `null` to render nothing at all.
   *
   * Whatever you return is mounted in the same background surface the views use,
   * so {@link FileSystemProps.getBackgroundContextMenuActions} still opens on a
   * right-click (web) or long-press (native) anywhere in the empty area.
   *
   * Called as a plain function, not rendered as a component, for the same reason
   * as {@link FileSystemProps.renderBody} — don't call hooks directly in it, put
   * them in a component you render inside the returned tree.
   *
   * ```tsx
   * renderEmptyState={({ reason, label }) =>
   *   reason === 'empty-folder' ? <DropZone onPick={upload} /> : undefined
   * }
   * ```
   */
  renderEmptyState?: (args: FileSystemEmptyStateArgs) => ReactNode;
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
