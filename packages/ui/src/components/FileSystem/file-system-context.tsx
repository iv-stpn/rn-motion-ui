/** biome-ignore-all lint/style/noExcessiveLinesPerFile: store factory + 8 slice types + 14 selector hooks all belong here */
// Per-instance Zustand store distributed via a thin React context that holds
// the store reference (never changes value → zero re-renders from the context
// itself). State is divided into 8 shallow slices; per-slice selector hooks use
// useShallow so components only re-render when their slice changes.

import type { ReactNode } from 'react';
import { createContext, type RefObject, useContext } from 'react';
import type { TextInput } from 'react-native';
import { createStore, useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type {
  FileEntry,
  FileSystemContextMenuAction,
  FileSystemDateFilterType,
  FileSystemEmptyStateArgs,
  FileSystemEntry,
  FileSystemFileItem,
  FileSystemFilter,
  FileSystemFilterOperator,
  FileSystemIndex,
  FileSystemItem,
  FileSystemLoadChildrenArgs,
  FileSystemLoadChildrenResult,
  FileSystemMoveEvent,
  FileSystemSortKey,
  FileSystemSortState,
  FileSystemView,
  FileSystemViewerArgs,
  FileTypeFilterOption,
} from './file-system.types';
import type { DateRange } from './file-system-calendar';
import { fileMatchesFilter, isCustomDateRangeValue } from './file-system-filter';
import { buildFileSystemIndex } from './file-system-index';
import { fileTypeFilterGroup, MIME_TYPE_LABELS, mimeTypeForFile, viewerKindForFile } from './file-system-kinds';
import { normalizeFolderPath, pathName } from './file-system-paths';
import { DEFAULT_SORT, defaultSortDirection } from './file-system-sort';
import type { HeaderLayout } from './file-system-toolbar-parts';
import type { FileSystemOpenedFile } from './file-system-viewer-modal';
import { computeVisiblePaths, filterIndexToVisible, sortIndexChildren } from './file-system-visibility';

// ── DateRangeRequest ─────────────────────────────────────────────────────────
// Moved here from use-file-system-filters.ts (deleted in this refactor).
// Re-exported so file-system-date-range-modal.tsx can update its import path.
// biome-ignore lint/style/useExportsLast: co-located with the filter slice types it belongs to
export type DateRangeRequest = {
  /** Monotonically increasing — ensures a re-open of the same facet remounts the form. */
  id: number;
  initialRange?: DateRange;
  type: FileSystemDateFilterType;
};

// ── Slice types ───────────────────────────────────────────────────────────────

type NavigationSlice = {
  currentPath: string;
  currentFolderName: string;
  canGoBack: boolean;
  canGoForward: boolean;
  historyIndex: number;
  historyStack: string[];
  loadingFolders: Set<string>;
  isLoadingCurrentFolder: boolean;
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
  selectedPath: string | null;
  selectedEntry: FileSystemEntry | null;
};

type SearchSlice = {
  searchInput: string;
  searchQuery: string;
  isSearching: boolean;
  isSearchExpanded: boolean;
  searchInputRef: RefObject<TextInput | null>;
};

type FiltersSlice = {
  filters: FileSystemFilter[];
  fileFilter: ((file: FileEntry) => boolean) | null;
  fileTypeOptions: FileTypeFilterOption[];
  hasActiveFilters: boolean;
  dateRangeRequest: DateRangeRequest | null;
};

type ViewerSlice = {
  opened: FileSystemOpenedFile | null;
  resolvedUrlCache: Map<string, string>;
  pageUrlCache: Map<string, string>;
};

type LayoutSlice = {
  layout: HeaderLayout;
  isCompact: boolean;
};

type ConsumerSlice = {
  title: string;
  loadChildren?: (args: FileSystemLoadChildrenArgs) => Promise<FileSystemLoadChildrenResult>;
  draggable?: boolean;
  testID?: string;
  getBackgroundContextMenuActions?: () => FileSystemContextMenuAction[];
  getContextMenuActions?: (item: FileSystemItem) => FileSystemContextMenuAction[];
  getFileUrl?: (file: FileSystemFileItem) => string | Promise<string>;
  loadPreviewImageUrl?: (file: FileSystemFileItem, pageIndex: number) => Promise<string | null>;
  onBackgroundContextMenuAction?: (action: FileSystemContextMenuAction) => void | Promise<void>;
  onContextMenuAction?: (action: FileSystemContextMenuAction, item: FileSystemItem) => void | Promise<void>;
  onFileOpen?: (file: FileSystemFileItem, url: string | null) => void;
  onMove?: (event: FileSystemMoveEvent) => void;
  onSelectionChange?: (item: FileSystemItem | null) => void;
  onViewChange?: (view: FileSystemView) => void;
  renderEmptyState?: (args: FileSystemEmptyStateArgs) => ReactNode;
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
  selectEntry: (entry: FileSystemEntry | null) => void;
  openEntry: (entry: FileSystemEntry) => void;
  selectAndPrefetch: (entry: FileSystemEntry | null) => void;
  // Search
  setSearchInput: (value: string) => void;
  setIsSearchExpanded: (expanded: boolean) => void;
  // Filters
  toggleFileTypeFilterValue: (mime: string, checked: boolean) => void;
  setDatePresetFilter: (type: FileSystemDateFilterType, preset: string) => void;
  openDateRangeRequest: (type: FileSystemDateFilterType) => void;
  closeDateRangeRequest: () => void;
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

/** Add/remove a MIME from the single file-type pill, retiring it when empty. */
function nextFileTypeFilters(previous: FileSystemFilter[], id: string, mime: string, checked: boolean): FileSystemFilter[] {
  const existing = previous.find((f) => f.type === 'fileType');
  if (!existing) {
    if (!checked) return previous;
    return [...previous, { id, operator: 'is', type: 'fileType', value: [mime] }];
  }
  const value = checked ? [...new Set([...existing.value, mime])] : existing.value.filter((v) => v !== mime);
  if (value.length === 0) return previous.filter((f) => f !== existing);
  const tracksCount = existing.operator === 'is' || existing.operator === 'is-any-of';
  const countOperator: FileSystemFilterOperator = value.length > 1 ? 'is-any-of' : 'is';
  const operator = tracksCount ? countOperator : existing.operator;
  return previous.map((f) => (f === existing ? { ...f, operator, value } : f));
}

/** Distinct MIME types across the index, labeled for the filter menu. */
function computeFileTypeOptions(index: FileSystemIndex): FileTypeFilterOption[] {
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
  return [...byMime.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Recomputes every derived field that depends on `index`, `filters`,
 * `searchQuery`, `sort`, or `currentPath`. Called from any mutating action.
 * Also auto-deselects when the selected path falls outside the visible set.
 */
function _recomputeEntries(s: FileSystemStore): {
  entries: EntriesSlice;
  filters: FiltersSlice;
  selection: SelectionSlice;
} {
  const { currentPath } = s.navigation;
  const { index, sort } = s.entries;
  const { filters } = s.filters;
  const { searchQuery } = s.search;

  const fileFilter = filters.length === 0 ? null : (file: FileEntry) => filters.every((f) => fileMatchesFilter(file, f));
  const fileTypeOptions = computeFileTypeOptions(index);

  const visiblePaths = computeVisiblePaths({ currentPath, fileFilter, index, searchQuery });
  const visibleIndex = filterIndexToVisible(index, visiblePaths);
  const sortedIndex = sortIndexChildren(visibleIndex, sort);
  const entries = sortedIndex.children.get(currentPath) ?? [];

  const { selectedPath } = s.selection;
  const deselect = selectedPath !== null && visiblePaths !== null && !visiblePaths.has(selectedPath);
  const newSelectedPath = deselect ? null : selectedPath;
  const newSelectedEntry =
    newSelectedPath === null ? null : (index.files.get(newSelectedPath) ?? index.folders.get(newSelectedPath) ?? null);

  if (deselect) s.consumer.onSelectionChange?.(null);

  return {
    entries: { ...s.entries, sortedIndex, entries },
    filters: { ...s.filters, fileFilter, fileTypeOptions, hasActiveFilters: filters.length > 0 },
    selection: { selectedPath: newSelectedPath, selectedEntry: newSelectedEntry },
  };
}

// ── Init type + factory ───────────────────────────────────────────────────────

export type FileSystemStoreInit = {
  items: FileSystemItem[];
  title: string;
  defaultPath: string;
  defaultView: FileSystemView;
  loadChildren?: ConsumerSlice['loadChildren'];
  draggable?: boolean;
  testID?: string;
  getBackgroundContextMenuActions?: ConsumerSlice['getBackgroundContextMenuActions'];
  getContextMenuActions?: ConsumerSlice['getContextMenuActions'];
  getFileUrl?: ConsumerSlice['getFileUrl'];
  loadPreviewImageUrl?: ConsumerSlice['loadPreviewImageUrl'];
  onBackgroundContextMenuAction?: ConsumerSlice['onBackgroundContextMenuAction'];
  onContextMenuAction?: ConsumerSlice['onContextMenuAction'];
  onFileOpen?: ConsumerSlice['onFileOpen'];
  onMove?: ConsumerSlice['onMove'];
  onSelectionChange?: ConsumerSlice['onSelectionChange'];
  onViewChange?: ConsumerSlice['onViewChange'];
  renderEmptyState?: ConsumerSlice['renderEmptyState'];
  renderFilePreview?: ConsumerSlice['renderFilePreview'];
  renderFileViewer?: ConsumerSlice['renderFileViewer'];
};

export type FileSystemStoreApi = ReturnType<typeof createFileSystemStore>;

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: store factory wires 8 slices + 20 actions; splitting would scatter state that belongs together
export function createFileSystemStore(init: FileSystemStoreInit) {
  // Non-reactive closure state — never needs to trigger re-renders
  const requestedFolders = new Set<string>();
  let filterIdCounter = 0;
  let requestIdCounter = 0;
  const nextFilterId = () => {
    filterIdCounter += 1;
    return `filter-${filterIdCounter}`;
  };
  // Guard: same-path re-selections are no-ops (avoids redundant onSelectionChange calls)
  let lastSelectedPath: string | null = null;

  const initialPath = normalizeFolderPath(init.defaultPath);
  const initialIndex = buildFileSystemIndex(init.items);

  // biome-ignore lint/complexity/noExcessiveLinesPerFunction: all slices share a single closure for cross-slice access via get(); splitting would break the dependency graph
  return createStore<FileSystemStore>((set, get) => ({
    // ── Initial slice state ─────────────────────────────────────────────────
    navigation: {
      currentPath: initialPath,
      currentFolderName: initialPath === '' ? init.title : pathName(initialPath) || init.title,
      canGoBack: false,
      canGoForward: false,
      historyIndex: 0,
      historyStack: [initialPath],
      loadingFolders: new Set<string>(),
      isLoadingCurrentFolder: false,
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
    selection: { selectedPath: null, selectedEntry: null },
    search: {
      searchInput: '',
      searchQuery: '',
      isSearching: false,
      isSearchExpanded: false,
      searchInputRef: { current: null },
    },
    filters: {
      filters: [],
      fileFilter: null,
      fileTypeOptions: computeFileTypeOptions(initialIndex),
      hasActiveFilters: false,
      dateRangeRequest: null,
    },
    viewer: {
      opened: null,
      resolvedUrlCache: new Map<string, string>(),
      pageUrlCache: new Map<string, string>(),
    },
    layout: { layout: 'full', isCompact: false },
    consumer: {
      title: init.title,
      loadChildren: init.loadChildren,
      draggable: init.draggable,
      testID: init.testID,
      getBackgroundContextMenuActions: init.getBackgroundContextMenuActions,
      getContextMenuActions: init.getContextMenuActions,
      getFileUrl: init.getFileUrl,
      loadPreviewImageUrl: init.loadPreviewImageUrl,
      onBackgroundContextMenuAction: init.onBackgroundContextMenuAction,
      onContextMenuAction: init.onContextMenuAction,
      onFileOpen: init.onFileOpen,
      onMove: init.onMove,
      onSelectionChange: init.onSelectionChange,
      onViewChange: init.onViewChange,
      renderEmptyState: init.renderEmptyState,
      renderFilePreview: init.renderFilePreview,
      renderFileViewer: init.renderFileViewer,
    },

    // ── Navigation actions ────────────────────────────────────────────────────
    navigateTo: (folderPath) => {
      const path = normalizeFolderPath(folderPath);
      const s = get();
      if (s.navigation.currentPath === path) return;
      const { historyIndex, historyStack } = s.navigation;
      const newStack = [...historyStack.slice(0, historyIndex + 1), path];
      const currentFolderName = path === '' ? s.consumer.title : pathName(path) || s.consumer.title;
      const newSearch = { ...s.search, searchInput: '', searchQuery: '', isSearching: false };
      const newHistoryIndex = newStack.length - 1;
      const newNav = {
        ...s.navigation,
        currentPath: path,
        currentFolderName,
        historyIndex: newHistoryIndex,
        historyStack: newStack,
        canGoBack: newHistoryIndex > 0,
        canGoForward: false,
      };
      const next = _recomputeEntries({ ...s, navigation: newNav, search: newSearch });
      set({
        navigation: { ...newNav, isLoadingCurrentFolder: newNav.loadingFolders.has(path) },
        entries: next.entries,
        filters: next.filters,
        selection: next.selection,
        search: newSearch,
      });
      lastSelectedPath = null;
      get().ensureChildren(path);
    },

    goBack: () => {
      const s = get();
      if (s.navigation.historyIndex === 0) return;
      const historyIndex = s.navigation.historyIndex - 1;
      const currentPath = s.navigation.historyStack[historyIndex] ?? '';
      const currentFolderName = currentPath === '' ? s.consumer.title : pathName(currentPath) || s.consumer.title;
      const newSearch = { ...s.search, searchInput: '', searchQuery: '', isSearching: false };
      const newNav = {
        ...s.navigation,
        historyIndex,
        currentPath,
        currentFolderName,
        canGoBack: historyIndex > 0,
        canGoForward: true,
        isLoadingCurrentFolder: s.navigation.loadingFolders.has(currentPath),
      };
      const next = _recomputeEntries({ ...s, navigation: newNav, search: newSearch });
      set({ navigation: newNav, entries: next.entries, filters: next.filters, selection: next.selection, search: newSearch });
      lastSelectedPath = null;
    },

    goForward: () => {
      const s = get();
      const maxIndex = s.navigation.historyStack.length - 1;
      if (s.navigation.historyIndex >= maxIndex) return;
      const historyIndex = s.navigation.historyIndex + 1;
      const currentPath = s.navigation.historyStack[historyIndex] ?? '';
      const currentFolderName = currentPath === '' ? s.consumer.title : pathName(currentPath) || s.consumer.title;
      const newSearch = { ...s.search, searchInput: '', searchQuery: '', isSearching: false };
      const newNav = {
        ...s.navigation,
        historyIndex,
        currentPath,
        currentFolderName,
        canGoBack: true,
        canGoForward: historyIndex < maxIndex,
        isLoadingCurrentFolder: s.navigation.loadingFolders.has(currentPath),
      };
      const next = _recomputeEntries({ ...s, navigation: newNav, search: newSearch });
      set({ navigation: newNav, entries: next.entries, filters: next.filters, selection: next.selection, search: newSearch });
      lastSelectedPath = null;
    },

    ensureChildren: (folderPath) => {
      const s = get();
      const folder = s.entries.index.folders.get(folderPath);
      if (!folder?.hasChildren) return;
      if (s.entries.index.children.get(folderPath)?.length) return;
      if (!s.consumer.loadChildren || requestedFolders.has(folderPath)) return;
      requestedFolders.add(folderPath);
      const newLoadingFolders = new Set(s.navigation.loadingFolders).add(folderPath);
      set({
        navigation: {
          ...s.navigation,
          loadingFolders: newLoadingFolders,
          isLoadingCurrentFolder: newLoadingFolders.has(s.navigation.currentPath),
        },
      });
      const drain = async () => {
        const load = s.consumer.loadChildren;
        if (!load) return; // guarded above; this silences the non-null assertion
        let cursor: string | null = null;
        try {
          do {
            // biome-ignore lint/performance/noAwaitInLoops: cursor paging is inherently sequential
            const result = await load({ cursor, path: folderPath });
            if (result.items.length) {
              const cur = get();
              const loadedItems = [...cur.navigation.loadedItems, ...result.items];
              const allItems = [...cur.entries.items, ...loadedItems];
              const index = buildFileSystemIndex(allItems);
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
        } finally {
          const cur = get();
          const lf = new Set(cur.navigation.loadingFolders);
          lf.delete(folderPath);
          set({
            navigation: {
              ...cur.navigation,
              loadingFolders: lf,
              isLoadingCurrentFolder: lf.has(cur.navigation.currentPath),
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
      const sort = { direction: defaultSortDirection(key), key };
      const next = _recomputeEntries({ ...s, entries: { ...s.entries, sort } });
      set({ entries: { ...next.entries, sort }, filters: next.filters, selection: next.selection });
    },

    toggleSortColumn: (key) => {
      const s = get();
      const prev = s.entries.sort;
      const sort =
        prev.key === key
          ? { direction: prev.direction === 'asc' ? ('desc' as const) : ('asc' as const), key }
          : { direction: defaultSortDirection(key), key };
      const next = _recomputeEntries({ ...s, entries: { ...s.entries, sort } });
      set({ entries: { ...next.entries, sort }, filters: next.filters, selection: next.selection });
    },

    _setItems: (items) => {
      const s = get();
      const allItems = s.navigation.loadedItems.length ? [...items, ...s.navigation.loadedItems] : items;
      const index = buildFileSystemIndex(allItems);
      const currentPath = s.navigation.currentPath;
      const currentFolderName = currentPath === '' ? s.consumer.title : pathName(currentPath) || s.consumer.title;
      const next = _recomputeEntries({ ...s, entries: { ...s.entries, items, index } });
      set({
        entries: { ...next.entries, items, index },
        filters: next.filters,
        selection: next.selection,
        navigation: { ...s.navigation, currentFolderName },
      });
    },

    // ── Selection actions ─────────────────────────────────────────────────────
    selectEntry: (entry) => {
      const path = entry?.path ?? null;
      if (lastSelectedPath === path) return;
      lastSelectedPath = path;
      const s = get();
      const selectedEntry = path === null ? null : (s.entries.index.files.get(path) ?? s.entries.index.folders.get(path) ?? null);
      set({ selection: { selectedPath: path, selectedEntry } });
      s.consumer.onSelectionChange?.(entry ?? null);
    },

    openEntry: (entry) => {
      if (entry.kind === 'folder') get().navigateTo(entry.path);
      else get().openFile(entry);
    },

    selectAndPrefetch: (entry) => {
      get().selectEntry(entry);
      if (entry?.kind === 'folder') get().ensureChildren(entry.path);
    },

    // ── Search actions ────────────────────────────────────────────────────────
    setSearchInput: (value) => {
      const s = get();
      const searchQuery = value.trim().replaceAll('\\', '/').toLowerCase();
      const newSearch = { ...s.search, searchInput: value, searchQuery, isSearching: searchQuery.length > 0 };
      const next = _recomputeEntries({ ...s, search: newSearch });
      set({ search: newSearch, entries: next.entries, filters: next.filters, selection: next.selection });
    },

    setIsSearchExpanded: (isSearchExpanded) => {
      set((s) => ({ search: { ...s.search, isSearchExpanded } }));
    },

    // ── Filter actions ────────────────────────────────────────────────────────
    toggleFileTypeFilterValue: (mime, checked) => {
      const s = get();
      const id = nextFilterId();
      const filters = nextFileTypeFilters(s.filters.filters, id, mime, checked);
      const next = _recomputeEntries({ ...s, filters: { ...s.filters, filters } });
      set({ filters: next.filters, entries: next.entries, selection: next.selection });
    },

    setDatePresetFilter: (type, preset) => {
      const s = get();
      const id = nextFilterId();
      const filters = [
        ...s.filters.filters.filter((f) => f.type !== type),
        { id, operator: 'after' as const, type, value: [preset] },
      ];
      const next = _recomputeEntries({ ...s, filters: { ...s.filters, filters } });
      set({ filters: next.filters, entries: next.entries, selection: next.selection });
    },

    openDateRangeRequest: (type) => {
      const s = get();
      const existing = s.filters.filters.find((f) => f.type === type);
      const bounds = existing && isCustomDateRangeValue(existing.value) ? existing.value : null;
      requestIdCounter += 1;
      set((cur) => ({
        filters: {
          ...cur.filters,
          dateRangeRequest: {
            id: requestIdCounter,
            initialRange: bounds ? { from: new Date(bounds[0]), to: new Date(bounds[1]) } : undefined,
            type,
          },
        },
      }));
    },

    closeDateRangeRequest: () => {
      set((s) => ({ filters: { ...s.filters, dateRangeRequest: null } }));
    },

    applyCustomDateRange: (type, from, to) => {
      const s = get();
      const id = nextFilterId();
      const existing = s.filters.filters.find((f) => f.type === type);
      const operator = existing?.operator === 'not-in-range' ? ('not-in-range' as const) : ('in-range' as const);
      const filters = [
        ...s.filters.filters.filter((f) => f.type !== type),
        { id, operator, type, value: [from.toISOString(), to.toISOString()] },
      ];
      const next = _recomputeEntries({ ...s, filters: { ...s.filters, filters } });
      set({ filters: next.filters, entries: next.entries, selection: next.selection });
    },

    setFilterOperator: (id, operator) => {
      const s = get();
      const filters = s.filters.filters.map((f) => (f.id === id ? { ...f, operator } : f));
      const next = _recomputeEntries({ ...s, filters: { ...s.filters, filters } });
      set({ filters: next.filters, entries: next.entries, selection: next.selection });
    },

    setFilterDatePreset: (id, preset) => {
      const s = get();
      const filters = s.filters.filters.map((f) => {
        if (f.id !== id) return f;
        const keepsOperator = f.operator === 'before' || f.operator === 'after';
        return { ...f, operator: keepsOperator ? f.operator : ('after' as const), value: [preset] };
      });
      const next = _recomputeEntries({ ...s, filters: { ...s.filters, filters } });
      set({ filters: next.filters, entries: next.entries, selection: next.selection });
    },

    removeFilter: (id) => {
      const s = get();
      const filters = s.filters.filters.filter((f) => f.id !== id);
      const next = _recomputeEntries({ ...s, filters: { ...s.filters, filters } });
      set({ filters: next.filters, entries: next.entries, selection: next.selection });
    },

    clearFilters: () => {
      const s = get();
      const next = _recomputeEntries({ ...s, filters: { ...s.filters, filters: [] } });
      set({ filters: next.filters, entries: next.entries, selection: next.selection });
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
      const changed = (Object.keys(patch) as Array<keyof ConsumerSlice>).some((k) => s.consumer[k] !== patch[k]);
      if (changed) set({ consumer: { ...s.consumer, ...patch } });
    },

    _syncLayout: (patch) => {
      const s = get();
      if (s.layout.layout !== patch.layout || s.layout.isCompact !== patch.isCompact) {
        set({ layout: patch });
      }
    },
  }));
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
    })),
  );
}

export function useFileSystemSearchActions() {
  return useStore(
    useFileSystemStoreContext(),
    useShallow((s) => ({ setSearchInput: s.setSearchInput, setIsSearchExpanded: s.setIsSearchExpanded })),
  );
}

export function useFileSystemFilterActions() {
  return useStore(
    useFileSystemStoreContext(),
    useShallow((s) => ({
      toggleFileTypeFilterValue: s.toggleFileTypeFilterValue,
      setDatePresetFilter: s.setDatePresetFilter,
      openDateRangeRequest: s.openDateRangeRequest,
      closeDateRangeRequest: s.closeDateRangeRequest,
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
