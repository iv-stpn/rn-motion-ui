/** biome-ignore-all lint/style/noExcessiveLinesPerFile: store factory + 8 slice types + 14 selector hooks all belong here */
// Per-instance Zustand store distributed via a thin React context that holds
// the store reference (never changes value → zero re-renders from the context
// itself). State is divided into 8 shallow slices; per-slice selector hooks use
// useShallow so components only re-render when their slice changes.

import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';
import { createStore, useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { objectKeys } from '../../../lib/typeguards';
import type {
  FileEntry,
  FileSystemContextMenuAction,
  FileSystemDateFilterType,
  FileSystemEmptyStateArgs,
  FileSystemEntry,
  FileSystemExternalDropEvent,
  FileSystemFileItem,
  FileSystemFilter,
  FileSystemFilterOperator,
  FileSystemIndex,
  FileSystemItem,
  FileSystemLoadChildrenArgs,
  FileSystemLoadChildrenResult,
  FileSystemMoveEvent,
  FileSystemSearchScope,
  FileSystemSortKey,
  FileSystemSortState,
  FileSystemView,
  FileSystemViewerArgs,
  FileTypeFilterOption,
} from './file-system.types';
import { buildFileSystemIndex } from './file-system-index';
import { fileTypeFilterGroup, MIME_TYPE_LABELS, mimeTypeForFile, viewerKindForFile } from './file-system-kinds';
import { normalizeFolderPath, pathName } from './file-system-paths';
import { flatSearchResults } from './file-system-search';
import type { FileSystemSelectionMode, FileSystemSelectionModifiers, FileSystemSelectionState } from './file-system-selection';
import {
  applyFileSystemMarquee,
  applyFileSystemSelection,
  EMPTY_FILE_SYSTEM_SELECTION,
  pruneFileSystemSelection,
} from './file-system-selection';
import { DEFAULT_SORT, defaultSortDirection } from './file-system-sort';
import type { HeaderLayout } from './file-system-toolbar-parts';
import type { FileSystemOpenedFile } from './file-system-viewer-modal';
import { computeVisiblePaths, fileMatchesFilter, filterIndexToVisible, sortIndexChildren } from './file-system-visibility';

// ── Slice types ───────────────────────────────────────────────────────────────

type NavigationSlice = {
  currentPath: string;
  currentFolderName: string;
  canGoBack: boolean;
  canGoForward: boolean;
  historyIndex: number;
  historyStack: string[];
  loadingFolders: Set<string>;
  /** Folders whose `loadChildren` call rejected or timed out. */
  errorFolders: Set<string>;
  isLoading: boolean;
  loadedItems: FileSystemItem[];
};

type EntriesSlice = {
  items: FileSystemItem[];
  index: FileSystemIndex;
  sortedIndex: FileSystemIndex;
  entries: FileSystemEntry[];
  view: FileSystemView;
  sort: FileSystemSortState;
};

type SelectionSlice = {
  /** The lead entry's path — see {@link FileSystemSelectionState.lead}. */
  selectedPath: string | null;
  selectedEntry: FileSystemEntry | null;
  /** Where a Shift-range measures from — see {@link FileSystemSelectionState.anchor}. Internal; no view reads it. */
  anchorPath: string | null;
  /**
   * Every selected path, in the order they were added. Holds exactly
   * `selectedPath` in `single` mode, and is empty only when nothing is selected.
   * Identity is stable across renders that leave the selection alone, so views
   * and `React.memo` boundaries can compare it by reference.
   */
  selectedPaths: ReadonlySet<string>;
};

type SearchSlice = {
  searchInput: string;
  searchQuery: string;
  isSearching: boolean;
  /** How much of the tree the query runs over — see {@link FileSystemSearchScope}. */
  scope: FileSystemSearchScope;
};

type FiltersSlice = {
  filters: FileSystemFilter[];
  fileFilter: ((file: FileEntry) => boolean) | null;
  fileTypeOptions: FileTypeFilterOption[];
  hasActiveFilters: boolean;
};

type ViewerSlice = {
  opened: FileSystemOpenedFile | null;
  resolvedUrlCache: Map<string, string>;
  pageUrlCache: Map<string, string>;
};

type LayoutSlice = { layout: HeaderLayout; isCompact: boolean };

type ConsumerSlice = {
  title: string;
  /** Leading breadcrumb segment — the `rootLabel` prop, falling back to `title`. */
  rootLabel: string;
  loadChildren?: (args: FileSystemLoadChildrenArgs) => Promise<FileSystemLoadChildrenResult>;
  draggable?: boolean;
  selectionMode: FileSystemSelectionMode;
  testID?: string;
  getBackgroundContextMenuActions?: () => FileSystemContextMenuAction[];
  getContextMenuActions?: (item: FileSystemItem) => FileSystemContextMenuAction[];
  getFileUrl?: (file: FileSystemFileItem) => string | Promise<string>;
  loadPreviewImageUrl?: (file: FileSystemFileItem, pageIndex: number) => Promise<string | null>;
  onBackgroundContextMenuAction?: (action: FileSystemContextMenuAction) => void | Promise<void>;
  onContextMenuAction?: (action: FileSystemContextMenuAction, item: FileSystemItem) => void | Promise<void>;
  onFileOpen?: (file: FileSystemFileItem, url: string | null) => void;
  onMove?: (event: FileSystemMoveEvent) => void;
  onExternalDrop?: (event: FileSystemExternalDropEvent) => void;
  onSelectedItemsChange?: (items: FileSystemItem[]) => void;
  onSelectionChange?: (item: FileSystemItem | null) => void;
  onViewChange?: (view: FileSystemView) => void;
  renderEmptyState?: (args: FileSystemEmptyStateArgs) => ReactNode;
  renderEntryIcon?: (entry: FileSystemEntry, size: number) => ReactNode | null | undefined;
  renderFilePreview?: (file: FileSystemFileItem) => ReactNode;
  renderFileViewer?: (args: FileSystemViewerArgs) => ReactNode;
};

// ── Actions ───────────────────────────────────────────────────────────────────

type FileSystemActions = {
  // Navigation
  navigateTo: (folderPath: string) => void;
  goBack: () => void;
  goForward: () => void;
  ensureChildren: (folderPath: string) => void;
  // Entries
  setView: (view: FileSystemView) => void;
  applySortKey: (key: FileSystemSortKey) => void;
  toggleSortColumn: (key: FileSystemSortKey) => void;
  _setItems: (items: FileSystemItem[]) => void;
  // Selection
  selectEntry: (
    entry: FileSystemEntry | null,
    modifiers?: FileSystemSelectionModifiers,
    orderedPaths?: readonly string[],
  ) => void;
  openEntry: (entry: FileSystemEntry) => void;
  selectAndPrefetch: (
    entry: FileSystemEntry | null,
    modifiers?: FileSystemSelectionModifiers,
    orderedPaths?: readonly string[],
  ) => void;
  clearSelection: () => void;
  /** One frame of a live selection box — see {@link applyFileSystemMarquee}. */
  selectMarquee: (covered: readonly string[], base: ReadonlySet<string> | null) => void;
  // Search
  setSearchInput: (value: string) => void;
  setSearchScope: (scope: FileSystemSearchScope) => void;
  // Filters
  toggleFileTypeFilterValue: (mime: string, checked: boolean) => void;
  setDatePresetFilter: (type: FileSystemDateFilterType, preset: string) => void;
  applyCustomDateRange: (type: FileSystemDateFilterType, from: Date, to: Date) => void;
  setFilterOperator: (id: string, operator: FileSystemFilterOperator) => void;
  setFilterDatePreset: (id: string, preset: string) => void;
  removeFilter: (id: string) => void;
  clearFilters: () => void;
  // Viewer
  openFile: (file: FileEntry) => void;
  closeFile: () => void;
  // Sync (called from file-system.tsx, not by internal components)
  _syncConsumer: (patch: Partial<ConsumerSlice>) => void;
  _syncLayout: (patch: LayoutSlice) => void;
};

// ── Full store type ───────────────────────────────────────────────────────────

type FileSystemStore = {
  navigation: NavigationSlice;
  entries: EntriesSlice;
  selection: SelectionSlice;
  search: SearchSlice;
  filters: FiltersSlice;
  viewer: ViewerSlice;
  layout: LayoutSlice;
  consumer: ConsumerSlice;
} & FileSystemActions;

// ── Pure helpers ──────────────────────────────────────────────────────────────

/**
 * A folder's display name: the consumer's title at the root, and for anything
 * else the last path segment — falling back to the title for a path that has no
 * nameable segment.
 */
function resolveFolderName(path: string, title: string): string {
  if (path === '') return title;
  return pathName(path) || title;
}

/** Add/remove a MIME from the single file-type pill, retiring it when empty. */
function nextFileTypeFilters(
  previous: FileSystemFilter[],
  mime: string,
  checked: boolean,
  nextId: () => string,
): FileSystemFilter[] {
  const existing = previous.find((f) => f.type === 'fileType');
  if (!existing) {
    if (!checked) return previous;
    return [...previous, { id: nextId(), operator: 'is', type: 'fileType', value: [mime] }];
  }
  const value = checked ? [...new Set([...existing.value, mime])] : existing.value.filter((v) => v !== mime);
  if (value.length === 0) return previous.filter((f) => f !== existing);
  const tracksCount = existing.operator === 'is' || existing.operator === 'is-any-of';
  const countOperator: FileSystemFilterOperator = value.length > 1 ? 'is-any-of' : 'is';
  const operator = tracksCount ? countOperator : existing.operator;
  return previous.map((f) => (f === existing ? { ...f, operator, value } : f));
}

function collectFileTypeOptions(index: FileSystemIndex): FileTypeFilterOption[] {
  const byMime = new Map<string, FileTypeFilterOption>();
  for (const file of index.files.values()) {
    const mime = mimeTypeForFile(file);
    if (!byMime.has(mime)) {
      const dotIndex = file.name.lastIndexOf('.');
      const extension = dotIndex > 0 ? file.name.slice(dotIndex + 1).toLowerCase() : '';
      byMime.set(mime, {
        group: fileTypeFilterGroup(mime),
        iconFileName: extension ? `file.${extension}` : file.name,
        label: MIME_TYPE_LABELS[mime] ?? mime,
        mime,
      });
    }
  }
  return [...byMime.values()].sort((left, right) => left.label.localeCompare(right.label));
}

// The options depend on the index alone, but `_recomputeEntries` runs on every
// mutating action — a selection, a sort, a filter — and most of those leave the
// index untouched. Keyed on index identity, so the walk-and-sort happens once
// per index rather than once per action, and the array stays reference-stable
// for the `useShallow` comparison in the filters slice.
let cachedFileTypeIndex: FileSystemIndex | null = null;
let cachedFileTypeOptions: FileTypeFilterOption[] = [];

/** Distinct MIME types across the index, labeled for the filter menu. */
function computeFileTypeOptions(index: FileSystemIndex): FileTypeFilterOption[] {
  if (cachedFileTypeIndex === index) return cachedFileTypeOptions;
  cachedFileTypeIndex = index;
  cachedFileTypeOptions = collectFileTypeOptions(index);
  return cachedFileTypeOptions;
}

type HistoryStep = {
  navigation: NavigationSlice;
  search: SearchSlice;
  entries: EntriesSlice;
  filters: FiltersSlice;
  selection: SelectionSlice;
};

/**
 * The full patch for a step through the history stack. Three navigation actions
 * converge here — `goBack`, `goForward`, and `navigateTo` — so the work of
 * resetting the query, re-deriving the can-go flags, and recomputing everything
 * downstream of the folder that is now open lives in one place.
 *
 * `stack` is the history stack *after* the motion: `goBack`/`goForward` pass
 * the existing stack at the new index; `navigateTo` passes a new stack and the
 * index of the path it just appended.
 */
function navigationPatch(s: FileSystemStore, stack: string[], historyIndex: number): HistoryStep {
  const currentPath = stack[historyIndex] ?? '';
  const navigation: NavigationSlice = {
    ...s.navigation,
    historyIndex,
    currentPath,
    historyStack: stack,
    currentFolderName: resolveFolderName(currentPath, s.consumer.title),
    canGoBack: historyIndex > 0,
    canGoForward: historyIndex < stack.length - 1,
    isLoading: s.navigation.loadingFolders.has(currentPath),
  };
  const search: SearchSlice = { ...s.search, searchInput: '', searchQuery: '', isSearching: false };
  const next = _recomputeEntries({ ...s, navigation, search });
  return { navigation, search, entries: next.entries, filters: next.filters, selection: next.selection };
}

/** Resolve a path against the index — a file, a folder, or neither. */
function entryAt(index: FileSystemIndex, path: string | null): FileSystemEntry | null {
  if (path === null) return null;
  return index.files.get(path) ?? index.folders.get(path) ?? null;
}

/** The selection slice as the store holds it, rebuilt from a pure selection state. */
function selectionSliceFrom(state: FileSystemSelectionState, index: FileSystemIndex): SelectionSlice {
  return {
    anchorPath: state.anchor,
    selectedEntry: entryAt(index, state.lead),
    selectedPath: state.lead,
    selectedPaths: state.paths,
  };
}

/** The store's selection slice read back as the pure state the reducer takes. */
function selectionStateOf(selection: SelectionSlice): FileSystemSelectionState {
  return { anchor: selection.anchorPath, lead: selection.selectedPath, paths: selection.selectedPaths };
}

/**
 * Fire the consumer's selection callbacks for whichever part actually moved.
 * Both are compared by identity, which the reducer guarantees is meaningful:
 * a no-op press returns the same state and so notifies nothing.
 */
function notifySelectionChange(
  consumer: ConsumerSlice,
  index: FileSystemIndex,
  next: FileSystemSelectionState,
  previous: FileSystemSelectionState,
): void {
  if (next.lead !== previous.lead) consumer.onSelectionChange?.(entryAt(index, next.lead));
  if (next.paths !== previous.paths) {
    const items: FileSystemItem[] = [];
    for (const path of next.paths) {
      const entry = entryAt(index, path);
      if (entry) items.push(entry);
    }
    consumer.onSelectedItemsChange?.(items);
  }
}

/**
 * Recomputes every derived field that depends on `index`, `filters`,
 * `searchQuery`, `sort`, or `currentPath`. Called from any mutating action.
 * Also drops any selected path that falls outside the visible set.
 */
type RecomputedEntries = { entries: EntriesSlice; filters: FiltersSlice; selection: SelectionSlice };
function _recomputeEntries(s: FileSystemStore): RecomputedEntries {
  const { currentPath } = s.navigation;
  const { index, sort } = s.entries;
  const { filters } = s.filters;
  const { scope, searchQuery } = s.search;

  const fileFilter = filters.length === 0 ? null : (file: FileEntry) => filters.every((f) => fileMatchesFilter(file, f));
  const fileTypeOptions = computeFileTypeOptions(index);

  // A root-scoped query walks the whole manifest rather than the open folder's
  // subtree. Only a *query* widens: filters stay scoped to the folder they are
  // shown against, so the base falls back to `currentPath` whenever the query is
  // empty, however the scope is set.
  const isSearching = searchQuery.length > 0;
  const searchBase = isSearching && scope === 'root' ? '' : currentPath;

  const visiblePaths = computeVisiblePaths({ currentPath: searchBase, fileFilter, index, searchQuery });
  const visibleIndex = filterIndexToVisible(index, visiblePaths);
  const sortedIndex = sortIndexChildren(visibleIndex, sort);
  // While searching, `entries` is the flat hit list the search view draws —
  // every match at every depth, not the open folder's children. That is what the
  // status bar counts and what `renderBody` is handed, so all three agree; a
  // root-scoped hit outside the open folder would otherwise be drawn but not
  // counted.
  const entries = isSearching ? flatSearchResults(sortedIndex, searchQuery) : (sortedIndex.children.get(currentPath) ?? []);

  const previousSelection = selectionStateOf(s.selection);
  const nextSelection = pruneFileSystemSelection(previousSelection, visiblePaths);
  notifySelectionChange(s.consumer, index, nextSelection, previousSelection);

  return {
    entries: { ...s.entries, sortedIndex, entries },
    filters: { ...s.filters, fileFilter, fileTypeOptions, hasActiveFilters: filters.length > 0 },
    // Rebuilt even when the set held: `selectedEntry` is resolved against the
    // index, which a reload can have replaced under an unchanged selection.
    selection: selectionSliceFrom(nextSelection, index),
  };
}

// ── Init type + factory ───────────────────────────────────────────────────────

export type FileSystemStoreInit = {
  items: FileSystemItem[];
  title: string;
  rootLabel: string;
  defaultPath: string;
  defaultView: FileSystemView;
  loadChildren?: ConsumerSlice['loadChildren'];
  draggable?: boolean;
  selectionMode: FileSystemSelectionMode;
  testID?: string;
  getBackgroundContextMenuActions?: ConsumerSlice['getBackgroundContextMenuActions'];
  getContextMenuActions?: ConsumerSlice['getContextMenuActions'];
  getFileUrl?: ConsumerSlice['getFileUrl'];
  loadPreviewImageUrl?: ConsumerSlice['loadPreviewImageUrl'];
  onBackgroundContextMenuAction?: ConsumerSlice['onBackgroundContextMenuAction'];
  onContextMenuAction?: ConsumerSlice['onContextMenuAction'];
  onFileOpen?: ConsumerSlice['onFileOpen'];
  onMove?: ConsumerSlice['onMove'];
  onExternalDrop?: ConsumerSlice['onExternalDrop'];
  onSelectedItemsChange?: ConsumerSlice['onSelectedItemsChange'];
  onSelectionChange?: ConsumerSlice['onSelectionChange'];
  onViewChange?: ConsumerSlice['onViewChange'];
  renderEmptyState?: ConsumerSlice['renderEmptyState'];
  renderEntryIcon?: ConsumerSlice['renderEntryIcon'];
  renderFilePreview?: ConsumerSlice['renderFilePreview'];
  renderFileViewer?: ConsumerSlice['renderFileViewer'];
};

export type FileSystemStoreApi = ReturnType<typeof createFileSystemStore>;

/**
 * How long `loadChildren` gets before the store considers the folder failed.
 * After this many milliseconds the promise is abandoned and the folder is
 * added to `errorFolders` so the view can show a retry affordance.
 */
const CHILDREN_LOAD_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: store factory wires 8 slices + 20 actions; splitting would scatter state that belongs together
export function createFileSystemStore(init: FileSystemStoreInit) {
  // Non-reactive closure state — never needs to trigger re-renders
  const requestedFolders = new Set<string>();
  let filterIdCounter = 0;
  const nextFilterId = () => {
    filterIdCounter += 1;
    return `filter-${filterIdCounter}`;
  };

  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  const cancelSearchDebounce = () => {
    if (searchDebounceTimer !== null) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
  };

  const initialPath = normalizeFolderPath(init.defaultPath);
  const initialIndex = buildFileSystemIndex(init.items);

  // biome-ignore lint/complexity/noExcessiveLinesPerFunction: all slices share a single closure for cross-slice access via get(); splitting would break the dependency graph
  return createStore<FileSystemStore>((set, get) => {
    /** Recompute derived state from `overrides` applied to the current store, then flush {entries, filters, selection}. */
    function recomputeAndSet(overrides: Partial<FileSystemStore>) {
      const s = get();
      // biome-ignore lint: spreading full store + overrides is a valid store shape at runtime
      const next = _recomputeEntries({ ...s, ...overrides } as FileSystemStore);
      set({ entries: next.entries, filters: next.filters, selection: next.selection });
    }

    return {
      // ── Initial slice state ─────────────────────────────────────────────────
      navigation: {
        currentPath: initialPath,
        currentFolderName: resolveFolderName(initialPath, init.title),
        canGoBack: false,
        canGoForward: false,
        historyIndex: 0,
        historyStack: [initialPath],
        loadingFolders: new Set<string>(),
        errorFolders: new Set<string>(),
        isLoading: false,
        loadedItems: [],
      },
      entries: {
        items: init.items,
        index: initialIndex,
        sortedIndex: initialIndex,
        entries: initialIndex.children.get(initialPath) ?? [],
        view: init.defaultView,
        sort: DEFAULT_SORT,
      },
      selection: selectionSliceFrom(EMPTY_FILE_SYSTEM_SELECTION, initialIndex),
      search: {
        searchInput: '',
        searchQuery: '',
        isSearching: false,
        // The open folder's subtree, which is what the pipeline searched before the
        // scope existed. Widening is the deliberate act, not the default.
        scope: 'folder',
      },
      filters: {
        filters: [],
        fileFilter: null,
        fileTypeOptions: computeFileTypeOptions(initialIndex),
        hasActiveFilters: false,
      },
      viewer: {
        opened: null,
        resolvedUrlCache: new Map<string, string>(),
        pageUrlCache: new Map<string, string>(),
      },
      layout: { layout: 'full', isCompact: false },
      consumer: {
        title: init.title,
        rootLabel: init.rootLabel,
        loadChildren: init.loadChildren,
        draggable: init.draggable,
        selectionMode: init.selectionMode,
        testID: init.testID,
        getBackgroundContextMenuActions: init.getBackgroundContextMenuActions,
        getContextMenuActions: init.getContextMenuActions,
        getFileUrl: init.getFileUrl,
        loadPreviewImageUrl: init.loadPreviewImageUrl,
        onBackgroundContextMenuAction: init.onBackgroundContextMenuAction,
        onContextMenuAction: init.onContextMenuAction,
        onFileOpen: init.onFileOpen,
        onMove: init.onMove,
        onExternalDrop: init.onExternalDrop,
        onSelectedItemsChange: init.onSelectedItemsChange,
        onSelectionChange: init.onSelectionChange,
        onViewChange: init.onViewChange,
        renderEmptyState: init.renderEmptyState,
        renderEntryIcon: init.renderEntryIcon,
        renderFilePreview: init.renderFilePreview,
        renderFileViewer: init.renderFileViewer,
      },

      // ── Navigation actions ────────────────────────────────────────────────────
      navigateTo: (folderPath) => {
        cancelSearchDebounce();
        const path = normalizeFolderPath(folderPath);
        const s = get();
        if (s.navigation.currentPath === path) return;
        const newStack = [...s.navigation.historyStack.slice(0, s.navigation.historyIndex + 1), path];
        set(navigationPatch(s, newStack, newStack.length - 1));
        get().ensureChildren(path);
      },

      goBack: () => {
        cancelSearchDebounce();
        const s = get();
        if (s.navigation.historyIndex === 0) return;
        set(navigationPatch(s, s.navigation.historyStack, s.navigation.historyIndex - 1));
      },

      goForward: () => {
        cancelSearchDebounce();
        const s = get();
        if (s.navigation.historyIndex >= s.navigation.historyStack.length - 1) return;
        set(navigationPatch(s, s.navigation.historyStack, s.navigation.historyIndex + 1));
      },

      ensureChildren: (folderPath) => {
        const fileSystemStore = get();
        const folder = fileSystemStore.entries.index.folders.get(folderPath);

        if (!folder?.hasChildren) return;
        if (fileSystemStore.entries.index.children.get(folderPath)?.length) return;
        if (!fileSystemStore.consumer.loadChildren) return;
        // Prevent double-loading, but allow retry of failed folders.
        if (requestedFolders.has(folderPath) && !fileSystemStore.navigation.errorFolders.has(folderPath)) return;

        // Retry: clear from errorFolders and allow re-request.
        if (fileSystemStore.navigation.errorFolders.has(folderPath)) {
          const newErrorFolders = new Set(fileSystemStore.navigation.errorFolders);
          newErrorFolders.delete(folderPath);
          requestedFolders.delete(folderPath);
          set({ navigation: { ...fileSystemStore.navigation, errorFolders: newErrorFolders } });
        }

        requestedFolders.add(folderPath);
        const newLoadingFolders = new Set(fileSystemStore.navigation.loadingFolders).add(folderPath);

        const isLoading = newLoadingFolders.has(fileSystemStore.navigation.currentPath);
        set({ navigation: { ...fileSystemStore.navigation, loadingFolders: newLoadingFolders, isLoading } });

        const drain = async () => {
          const load = fileSystemStore.consumer.loadChildren;
          if (!load) return; // guarded above; this silences the non-null assertion
          let cursor: string | null = null;
          try {
            do {
              // biome-ignore lint/performance/noAwaitInLoops: cursor paging is inherently sequential
              const result: FileSystemLoadChildrenResult = await withTimeout(
                load({ cursor, path: folderPath }),
                CHILDREN_LOAD_TIMEOUT_MS,
              );
              if (result.items.length) {
                const cur = get();
                const loadedItems = [...cur.navigation.loadedItems, ...result.items];
                const allItems = [...cur.entries.items, ...loadedItems];
                // Preserve folders from the previous index that lost all their
                // children (e.g. every file was dragged out, or the load returned
                // only files). Without this, an inferred folder vanishes from the
                // tree when its last child leaves.
                const index = buildFileSystemIndex(allItems, { preserveFolders: cur.entries.index.folders });
                const next = _recomputeEntries({
                  ...cur,
                  entries: { ...cur.entries, index },
                  navigation: { ...cur.navigation, loadedItems },
                });
                set({
                  navigation: { ...cur.navigation, loadedItems },
                  entries: { ...next.entries, items: cur.entries.items, index },
                  filters: next.filters,
                  selection: next.selection,
                });
              }
              cursor = result.nextCursor ?? null;
            } while (cursor);
          } catch {
            requestedFolders.delete(folderPath);
            const cur = get();
            const newErrorFolders = new Set(cur.navigation.errorFolders).add(folderPath);
            set({
              navigation: {
                ...cur.navigation,
                errorFolders: newErrorFolders,
              },
            });
          } finally {
            const cur = get();
            const lf = new Set(cur.navigation.loadingFolders);
            lf.delete(folderPath);
            set({
              navigation: {
                ...cur.navigation,
                loadingFolders: lf,
                isLoading: lf.has(cur.navigation.currentPath),
              },
            });
          }
        };
        drain().catch(() => undefined);
      },

      // ── Entries actions ───────────────────────────────────────────────────────
      setView: (view) => {
        set((s) => ({ entries: { ...s.entries, view } }));
        get().consumer.onViewChange?.(view);
      },

      applySortKey: (key) => {
        const s = get();
        if (s.entries.sort.key === key) return;
        recomputeAndSet({ entries: { ...s.entries, sort: { direction: defaultSortDirection(key), key } } });
      },

      toggleSortColumn: (key) => {
        const s = get();
        const prev = s.entries.sort;
        const sort =
          prev.key === key
            ? { direction: prev.direction === 'asc' ? ('desc' as const) : ('asc' as const), key }
            : { direction: defaultSortDirection(key), key };
        recomputeAndSet({ entries: { ...s.entries, sort } });
      },

      _setItems: (items) => {
        const s = get();
        const allItems = s.navigation.loadedItems.length ? [...items, ...s.navigation.loadedItems] : items;
        // Preserve folders from the previous index that lost all their children
        // (e.g. every file was dragged out). Without this an inferred folder — one
        // the consumer never listed as `{ kind: 'folder', path: '...' }` — vanishes
        // from the tree when its last child leaves.
        const index = buildFileSystemIndex(allItems, { preserveFolders: s.entries.index.folders });
        const currentFolderName = resolveFolderName(s.navigation.currentPath, s.consumer.title);
        recomputeAndSet({ entries: { ...s.entries, items, index } });
        set({ navigation: { ...s.navigation, currentFolderName } });
      },

      // ── Selection actions ─────────────────────────────────────────────────────
      // The reducer decides what a press means and returns the previous state
      // untouched when it means nothing, so the identity check below is the whole
      // guard against redundant writes and duplicate consumer callbacks.
      selectEntry: (entry, modifiers, orderedPaths) => {
        const s = get();
        const previous = selectionStateOf(s.selection);
        const next = applyFileSystemSelection(previous, entry?.path ?? null, {
          mode: s.consumer.selectionMode,
          modifiers,
          orderedPaths,
        });
        if (next === previous) return;
        const { index } = s.entries;
        set({ selection: selectionSliceFrom(next, index) });
        notifySelectionChange(s.consumer, index, next, previous);
      },

      openEntry: (entry) => {
        if (entry.kind === 'folder') get().navigateTo(entry.path);
        else get().openFile(entry);
      },

      selectAndPrefetch: (entry, modifiers, orderedPaths) => {
        get().selectEntry(entry, modifiers, orderedPaths);
        // Only a plain press walks into a folder's children: a modified press is
        // building a selection, not stepping through the tree.
        if (entry?.kind === 'folder' && !(modifiers?.additive || modifiers?.range)) get().ensureChildren(entry.path);
      },

      clearSelection: () => get().selectEntry(null),

      selectMarquee: (covered, base) => {
        const s = get();
        const previous = selectionStateOf(s.selection);
        const next = applyFileSystemMarquee(previous, covered, base);
        if (next === previous) return;
        const { index } = s.entries;
        set({ selection: selectionSliceFrom(next, index) });
        notifySelectionChange(s.consumer, index, next, previous);
      },

      // ── Search actions ────────────────────────────────────────────────────────
      setSearchInput: (value) => {
        // Immediate update for UI responsiveness
        set((s) => ({ search: { ...s.search, searchInput: value } }));
        // Deferred recompute (200 ms debounce) for performance
        cancelSearchDebounce();
        searchDebounceTimer = setTimeout(() => {
          searchDebounceTimer = null;
          const s = get();
          const searchQuery = value.trim().replaceAll('\\', '/').toLowerCase();
          const newSearch = { ...s.search, searchInput: value, searchQuery, isSearching: searchQuery.length > 0 };
          recomputeAndSet({ search: newSearch });
          set({ search: newSearch });
        }, 200);
      },

      // Immediate, unlike `setSearchInput`: this is a press, not typing, so there
      // is no keystroke run to debounce. Recomputes only when a query is actually
      // running — with an empty field the scope is just remembered for the next
      // one, and any pending debounce reads it off the store when it fires.
      setSearchScope: (scope) => {
        const s = get();
        if (s.search.scope === scope) return;
        const newSearch = { ...s.search, scope };
        if (!s.search.isSearching) {
          set({ search: newSearch });
          return;
        }
        recomputeAndSet({ search: newSearch });
        set({ search: newSearch });
      },

      // ── Filter actions ────────────────────────────────────────────────────────
      toggleFileTypeFilterValue: (mime, checked) => {
        const s = get();
        const filters = nextFileTypeFilters(s.filters.filters, mime, checked, nextFilterId);
        recomputeAndSet({ filters: { ...s.filters, filters } });
      },

      setDatePresetFilter: (type, preset) => {
        const s = get();
        const id = nextFilterId();
        const filters = [
          ...s.filters.filters.filter((f) => f.type !== type),
          { id, operator: 'after' as const, type, value: [preset] },
        ];
        recomputeAndSet({ filters: { ...s.filters, filters } });
      },

      // Replaces any existing filter of the same facet, keeping a negated range
      // negated — re-picking dates on a "not in range" filter re-values it rather
      // than silently flipping what it means.
      applyCustomDateRange: (type, from, to) => {
        const s = get();
        const id = nextFilterId();
        const existing = s.filters.filters.find((f) => f.type === type);
        const operator = existing?.operator === 'not-in-range' ? ('not-in-range' as const) : ('in-range' as const);
        const filters = [
          ...s.filters.filters.filter((f) => f.type !== type),
          { id, operator, type, value: [from.toISOString(), to.toISOString()] },
        ];
        recomputeAndSet({ filters: { ...s.filters, filters } });
      },

      setFilterOperator: (id, operator) => {
        const s = get();
        const filters = s.filters.filters.map((f) => (f.id === id ? { ...f, operator } : f));
        recomputeAndSet({ filters: { ...s.filters, filters } });
      },

      setFilterDatePreset: (id, preset) => {
        const s = get();
        const filters = s.filters.filters.map((f) => {
          if (f.id !== id) return f;
          const keepsOperator = f.operator === 'before' || f.operator === 'after';
          return { ...f, operator: keepsOperator ? f.operator : ('after' as const), value: [preset] };
        });
        recomputeAndSet({ filters: { ...s.filters, filters } });
      },

      removeFilter: (id) => {
        const s = get();
        const filters = s.filters.filters.filter((f) => f.id !== id);
        recomputeAndSet({ filters: { ...s.filters, filters } });
      },

      clearFilters: () => {
        recomputeAndSet({ filters: { ...get().filters, filters: [] } });
      },

      // ── Viewer actions ────────────────────────────────────────────────────────
      openFile: (file) => {
        const s = get();
        const { getFileUrl, onFileOpen, renderFileViewer } = s.consumer;
        const kind = viewerKindForFile(file);
        const isViewable = kind === 'image' || (kind !== null && Boolean(renderFileViewer));
        const show = async () => {
          const knownUrl = file.url ?? s.viewer.resolvedUrlCache.get(file.path) ?? null;
          let url: string | null = knownUrl;
          if (!url && getFileUrl) {
            try {
              const resolved = await getFileUrl(file);
              if (resolved) {
                url = resolved;
                get().viewer.resolvedUrlCache.set(file.path, resolved);
              }
            } catch {
              /* falls back to null */
            }
          }
          if (onFileOpen) onFileOpen(file, url);
          else if (kind && isViewable) set((cur) => ({ viewer: { ...cur.viewer, opened: { file, kind, url } } }));
        };
        show().catch(() => undefined);
      },

      closeFile: () => set((s) => ({ viewer: { ...s.viewer, opened: null } })),

      // ── Sync actions (called from file-system.tsx, never by internal components)
      _syncConsumer: (patch) => {
        const s = get();
        const changed = objectKeys(patch).some((k) => s.consumer[k] !== patch[k]);
        if (changed) set({ consumer: { ...s.consumer, ...patch } });
      },

      _syncLayout: (patch) => {
        const s = get();
        if (s.layout.layout !== patch.layout || s.layout.isCompact !== patch.isCompact) set({ layout: patch });
      },
    };
  });
}

// ── React context ─────────────────────────────────────────────────────────────

export const FileSystemStoreContext = createContext<FileSystemStoreApi | null>(null);

export function useFileSystemStoreContext(): FileSystemStoreApi {
  const store = useContext(FileSystemStoreContext);
  if (!store) throw new Error('useFileSystemStoreContext must be used within <FileSystem>');
  return store;
}

// ── Per-slice state hooks ─────────────────────────────────────────────────────

export function useFileSystemNavigation() {
  return useStore(
    useFileSystemStoreContext(),
    useShallow((s) => s.navigation),
  );
}
export function useFileSystemEntries() {
  return useStore(
    useFileSystemStoreContext(),
    useShallow((s) => s.entries),
  );
}
export function useFileSystemSelection() {
  return useStore(
    useFileSystemStoreContext(),
    useShallow((s) => s.selection),
  );
}
export function useFileSystemSearch() {
  return useStore(
    useFileSystemStoreContext(),
    useShallow((s) => s.search),
  );
}
export function useFileSystemFilters() {
  return useStore(
    useFileSystemStoreContext(),
    useShallow((s) => s.filters),
  );
}
export function useFileSystemViewer() {
  return useStore(
    useFileSystemStoreContext(),
    useShallow((s) => s.viewer),
  );
}
export function useFileSystemLayout() {
  return useStore(
    useFileSystemStoreContext(),
    useShallow((s) => s.layout),
  );
}
export function useFileSystemConsumer() {
  return useStore(
    useFileSystemStoreContext(),
    useShallow((s) => s.consumer),
  );
}

// ── Per-slice action hooks ────────────────────────────────────────────────────

export function useFileSystemNavigationActions() {
  return useStore(
    useFileSystemStoreContext(),
    useShallow((s) => ({
      navigateTo: s.navigateTo,
      goBack: s.goBack,
      goForward: s.goForward,
      ensureChildren: s.ensureChildren,
    })),
  );
}

export function useFileSystemSelectionActions() {
  return useStore(
    useFileSystemStoreContext(),
    useShallow((s) => ({
      selectEntry: s.selectEntry,
      openEntry: s.openEntry,
      selectAndPrefetch: s.selectAndPrefetch,
      clearSelection: s.clearSelection,
      selectMarquee: s.selectMarquee,
    })),
  );
}

export function useFileSystemSearchActions() {
  return useStore(
    useFileSystemStoreContext(),
    useShallow((s) => ({ setSearchInput: s.setSearchInput, setSearchScope: s.setSearchScope })),
  );
}

export function useFileSystemFilterActions() {
  return useStore(
    useFileSystemStoreContext(),
    useShallow((s) => ({
      toggleFileTypeFilterValue: s.toggleFileTypeFilterValue,
      setDatePresetFilter: s.setDatePresetFilter,
      applyCustomDateRange: s.applyCustomDateRange,
      setFilterOperator: s.setFilterOperator,
      setFilterDatePreset: s.setFilterDatePreset,
      removeFilter: s.removeFilter,
      clearFilters: s.clearFilters,
    })),
  );
}

export function useFileSystemViewerActions() {
  return useStore(
    useFileSystemStoreContext(),
    useShallow((s) => ({ openFile: s.openFile, closeFile: s.closeFile })),
  );
}

export function useFileSystemEntriesActions() {
  return useStore(
    useFileSystemStoreContext(),
    useShallow((s) => ({ setView: s.setView, applySortKey: s.applySortKey, toggleSortColumn: s.toggleSortColumn })),
  );
}
