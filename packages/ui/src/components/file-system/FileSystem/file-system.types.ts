/** biome-ignore-all lint/style/noExcessiveLinesPerFile: one public data model — the props type and the shapes its callbacks pass belong in one place */
// Public data model for <FileSystem>. Kept RN-free so the logic modules and
// their unit tests can import it without pulling in the render layer.
//
// Path model: every entry IS its path. Folder paths carry a
// trailing slash, file paths never do, and the empty string is the implicit
// root. Consumers may hand in a flat manifest of files only — missing folder
// prefixes are inferred by `buildFileSystemIndex`.

import type { ReactNode } from 'react';
import type { MenuItemIcon } from '../../RowPrimitive/menu-item';
import type { FileSystemSelectionMode } from './file-system-selection';

/** One entry in the list returned by `getContextMenuActions`. */
export type FileSystemContextMenuAction = {
  id: string;
  label: string;
  /**
   * Leading icon. Pass either a sized ReactNode (`<Trash2 size={16} />`) or a
   * component matching `MenuItemIcon` (`(props: IconProps) => ReactNode`).
   */
  icon?: ReactNode | MenuItemIcon;
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
  /** ISO-8601 timestamp when pinned; absent or `null` means not pinned. Pinned entries float above all others in their parent folder regardless of the active sort key. */
  pinnedAt?: string | null;
  /** ISO-8601 timestamp when favorited. Boosts the entry in search results but does not affect per-folder ordering. */
  favoritedAt?: string | null;
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
  /** ISO-8601 timestamp when pinned; absent or `null` means not pinned. Pinned entries float above all others in their parent folder regardless of the active sort key. */
  pinnedAt?: string | null;
  /** ISO-8601 timestamp when favorited. Boosts the entry in search results but does not affect per-folder ordering. */
  favoritedAt?: string | null;
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

/**
 * How much of the tree a query runs over.
 *
 * - `'folder'` — the open folder and everything under it. What a query has
 *   always done, and the default.
 * - `'root'` — the whole manifest, wherever you happen to be standing.
 *
 * Filters are unaffected either way: they stay scoped to the open folder, which
 * is the surface they are shown against.
 */
export type FileSystemSearchScope = 'folder' | 'root';

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

/**
 * State snapshot passed to {@link FileSystemProps.renderFilters}. Exposes every
 * search / sort / filter action so a fully-custom filter bar can drive the same
 * built-in filtering logic without re-implementing it.
 */
export type FileSystemFiltersState = {
  // Search
  searchValue: string;
  setSearchValue: (value: string) => void;
  isSearching: boolean;
  /** How much of the tree the query runs over — see {@link FileSystemSearchScope}. */
  searchScope: FileSystemSearchScope;
  setSearchScope: (scope: FileSystemSearchScope) => void;
  /**
   * The two things a scope control names: the whole tree, and the folder that is
   * open. `rootLabel` is the {@link FileSystemProps.rootLabel} prop (falling back
   * to `title`); `folderName` is the open folder's display name.
   */
  rootLabel: string;
  folderName: string;
  /**
   * `true` while the open folder *is* the root, where the two scopes select the
   * same set. A scope control wants to show one option there rather than two that
   * do the same thing.
   */
  isAtRoot: boolean;
  // Sort
  sort: FileSystemSortState;
  setSortKey: (key: FileSystemSortKey) => void;
  // Filters
  /**
   * The active filter rows, ANDed together. Each carries the `id` the
   * row-addressed actions below take, so a filter-pill UI can re-value or drop
   * one row without touching the rest.
   */
  filters: FileSystemFilter[];
  fileTypeOptions: FileTypeFilterOption[];
  toggleFileType: (mime: string, checked: boolean) => void;
  /**
   * Set the date filter for `type` from a relative preset, replacing any filter
   * of that type rather than stacking beside it. Presets slide with the clock —
   * they resolve at filter time, not when they are picked.
   *
   * Accepts `'1 day ago'`, `'3 days ago'`, `'1 week ago'`, `'1 month ago'`,
   * `'3 months ago'`, `'6 months ago'`, `'1 year ago'` — or any other string
   * `Date.parse` understands, for a fixed cutoff.
   */
  selectDatePreset: (type: FileSystemDateFilterType, preset: string) => void;
  /**
   * Set the date filter for `type` to an explicit range, replacing any filter of
   * that type. The component ships no date picker — bring your own, then hand
   * the two ends over here.
   */
  applyCustomRange: (type: FileSystemDateFilterType, from: Date, to: Date) => void;
  /**
   * Switch one row's operator, addressed by `FileSystemFilter.id` — negating a
   * filter without rebuilding its value.
   */
  setFilterOperator: (id: string, operator: FileSystemFilterOperator) => void;
  /** Re-value one date row from a preset, addressed by `FileSystemFilter.id`. */
  setFilterDatePreset: (id: string, preset: string) => void;
  /** Drop one row, addressed by `FileSystemFilter.id`. */
  removeFilter: (id: string) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  /**
   * How many entries are visible: the open folder's, after filters and sort — or,
   * while a query is running, how many results it found across the scope it ran
   * over, which is what the search view draws.
   */
  count: number;
};

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
  // Sort
  sort: FileSystemSortState;
  setSortKey: (key: FileSystemSortKey) => void;
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
  isLoading: boolean;
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
  /** Label for the root folder. */
  title?: string;
  /**
   * Name the root carries in breadcrumb trails — the leading segment of the bar
   * under the header, and of the folder line under each search result.
   *
   * Defaults to {@link FileSystemProps.title}, so the trail reads the same as
   * the header unless you want a shorter or more literal root than the title
   * (`'Files'` in the header, `'My Drive'` in the trail).
   */
  rootLabel?: string;
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
   * Render a custom icon for an entry instead of the default file-type icon or
   * folder glyph. Receives the entry and the pixel size that fits the current
   * view context. Return `null` or `undefined` to fall back to the default.
   */
  renderEntryIcon?: (entry: FileSystemEntry, size: number) => ReactNode | null | undefined;
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
  /**
   * Called when the user drops something from outside the component onto the
   * file area — an OS file, or a custom element on the page that sets drag data
   * in its `dragstart` handler. Web only; ignored on native.
   *
   * The component does not inspect the transfer — read `dataTransfer.files` for
   * OS files, or `dataTransfer.getData(mime)` for data from another element.
   * `destination` is the folder open at the time of the drop.
   *
   * When provided, the file area accepts external drags and shows a drop-zone
   * overlay while an external drag hovers over it.
   */
  onExternalDrop?: (event: FileSystemExternalDropEvent) => void;
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
   * Render a custom filter / search / sort bar between the breadcrumbs and the
   * file area. Receives every search, sort and filter action so your bar drives
   * the same built-in filtering logic without re-implementing it.
   *
   * When omitted, no default filter UI is shown — the header only contains
   * navigation and the view-mode switcher.
   *
   * The node is rendered inside the same root container as the header and body,
   * so it participates in layout normally. Give it `shrink-0` if it should not
   * be squashed by the file area.
   */
  renderFilters?: (state: FileSystemFiltersState & { testID?: string }) => ReactNode;
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
   *   reason === 'empty-folder' ? <EmptyFolderPlaceholder onPick={upload} /> : undefined
   * }
   * ```
   */
  renderEmptyState?: (args: FileSystemEmptyStateArgs) => ReactNode;
  /** Extra UniWind classes merged onto the root container. */
  className?: string;
  /** Extra UniWind classes merged onto the built-in header's root view. Ignored when `renderHeader` is provided. */
  headerClassName?: string;
  /** Extra UniWind classes merged onto the file-area root view. */
  bodyClassName?: string;
  /** Extra UniWind classes merged onto the built-in footer's root view. Ignored when `renderFooter` is provided. */
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

/**
 * Emitted by {@link FileSystemProps.onExternalDrop} when the user drops
 * something from outside the component — the OS file picker, another element
 * on the page, or anything else the browser delivers via the HTML5 drag API.
 *
 * The component does not inspect the transfer — that is the consumer's job.
 * Read `dataTransfer.files` for OS files, or `dataTransfer.getData(mime)` for
 * data set by another element's `dragstart` handler.
 */
export type FileSystemExternalDropEvent = {
  /**
   * Folder path the drop landed in (trailing slash). Empty string `''` is the
   * implicit root. Reflects the folder open at the time of the drop.
   */
  destination: string;
  /** The raw HTML5 DataTransfer object from the browser drop event. */
  dataTransfer: DataTransfer;
};
