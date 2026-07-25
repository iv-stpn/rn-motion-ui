/** biome-ignore-all lint/style/useExportsLast: hooks + their param/return types read best together */
/** biome-ignore-all lint/style/noExcessiveLinesPerFile: the state core and the hooks it composes belong in one module */

// <FileSystem>'s state core: the index over the manifest, back/forward history,
// selection, search, sort, lazily loaded folders and the component-lifetime URL
// caches. Kept apart from the render layer so the toolbar and the four views
// each read only what they draw.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  FileEntry,
  FileSystemEntry,
  FileSystemItem,
  FileSystemLoadChildrenArgs,
  FileSystemLoadChildrenResult,
  FileSystemSortKey,
  FileSystemSortState,
  FileSystemView,
} from './file-system.types';
import { normalizeSearchQuery } from './file-system-filter';
import { buildFileSystemIndex } from './file-system-index';
import { normalizeFolderPath, pathName } from './file-system-paths';
import { DEFAULT_SORT, defaultSortDirection } from './file-system-sort';
import { computeVisiblePaths, filterIndexToVisible, sortIndexChildren } from './file-system-visibility';
import { type FileSystemFiltersState, useFileSystemFilters } from './use-file-system-filters';

export type UseFileSystemArgs = {
  items: FileSystemItem[];
  title: string;
  defaultPath: string;
  defaultView: FileSystemView;
  view?: FileSystemView;
  onViewChange?: (view: FileSystemView) => void;
  onSelectionChange?: (item: FileSystemItem | null) => void;
  loadChildren?: (args: FileSystemLoadChildrenArgs) => Promise<FileSystemLoadChildrenResult>;
};

/** Cursor-paged child loading for folders that advertise `hasChildren`. */
function useLazyChildren(loadChildren: UseFileSystemArgs['loadChildren']) {
  const [loadedItems, setLoadedItems] = useState<FileSystemItem[]>([]);
  const requestedFoldersRef = useRef(new Set<string>());
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(() => new Set());

  const stopLoading = useCallback((folderPath: string) => {
    setLoadingFolders((previous) => {
      const next = new Set(previous);
      next.delete(folderPath);
      return next;
    });
  }, []);

  // Drains every page before clearing the loading flag, so a folder never
  // renders half its children.
  const drainPages = useCallback(
    async (folderPath: string, load: NonNullable<UseFileSystemArgs['loadChildren']>) => {
      try {
        let cursor: string | null = null;
        do {
          // biome-ignore lint/performance/noAwaitInLoops: cursor paging is inherently sequential — the next request needs this page's cursor
          const result = await load({ cursor, path: folderPath });
          if (result.items.length) setLoadedItems((previous) => [...previous, ...result.items]);
          cursor = result.nextCursor ?? null;
        } while (cursor);
      } catch {
        // Allow a retry on the next visit.
        requestedFoldersRef.current.delete(folderPath);
      } finally {
        stopLoading(folderPath);
      }
    },
    [stopLoading],
  );

  const requestChildren = useCallback(
    (folderPath: string) => {
      if (!loadChildren) return;
      if (requestedFoldersRef.current.has(folderPath)) return;
      requestedFoldersRef.current.add(folderPath);
      setLoadingFolders((previous) => new Set(previous).add(folderPath));
      drainPages(folderPath, loadChildren).catch(() => stopLoading(folderPath));
    },
    [drainPages, loadChildren, stopLoading],
  );

  return { loadedItems, loadingFolders, requestChildren };
}

/** Back/forward stack over folder paths, plus the current path. */
function useNavigationHistory(defaultPath: string) {
  const [history, setHistory] = useState(() => ({ index: 0, stack: [normalizeFolderPath(defaultPath)] }));

  const push = useCallback((path: string) => {
    setHistory((previous) => {
      if (previous.stack[previous.index] === path) return previous;
      const stack = [...previous.stack.slice(0, previous.index + 1), path];
      return { index: stack.length - 1, stack };
    });
  }, []);

  const step = useCallback((delta: -1 | 1) => {
    setHistory((previous) => ({
      ...previous,
      index: Math.min(previous.stack.length - 1, Math.max(0, previous.index + delta)),
    }));
  }, []);

  return {
    canGoBack: history.index > 0,
    canGoForward: history.index < history.stack.length - 1,
    currentPath: history.stack[history.index] ?? '',
    push,
    step,
  };
}

export type FileSystemState = FileSystemFiltersState & {
  view: FileSystemView;
  setView: (view: FileSystemView) => void;
  currentPath: string;
  currentFolderName: string;
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: () => void;
  goForward: () => void;
  navigateTo: (folderPath: string) => void;
  /** Fully resolved index over `items` + lazily loaded children. */
  index: ReturnType<typeof buildFileSystemIndex>;
  /** `index` narrowed to the search/filter matches and re-sorted. */
  sortedIndex: ReturnType<typeof buildFileSystemIndex>;
  entries: FileSystemEntry[];
  selectedPath: string | null;
  selectedEntry: FileSystemEntry | null;
  selectEntry: (entry: FileSystemEntry | null) => void;
  searchInput: string;
  setSearchInput: (value: string) => void;
  searchQuery: string;
  isSearching: boolean;
  sort: FileSystemSortState;
  applySortKey: (key: FileSystemSortKey) => void;
  toggleSortColumn: (key: FileSystemSortKey) => void;
  loadingFolders: Set<string>;
  isLoadingCurrentFolder: boolean;
  ensureChildren: (folderPath: string) => void;
  resolvedUrlCache: Map<string, string>;
  pageUrlCache: Map<string, string>;
};

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: the state core wires one slice per concern (view, index, history, selection, search, sort) and reads top-to-bottom; splitting it would only move the wiring
export function useFileSystem({
  defaultPath,
  defaultView,
  items,
  loadChildren,
  onSelectionChange,
  onViewChange,
  title,
  view: viewProp,
}: UseFileSystemArgs): FileSystemState {
  const [internalView, setInternalView] = useState(defaultView);
  const view = viewProp ?? internalView;
  const setView = useCallback(
    (nextView: FileSystemView) => {
      setInternalView(nextView);
      onViewChange?.(nextView);
    },
    [onViewChange],
  );

  const { loadedItems, loadingFolders, requestChildren } = useLazyChildren(loadChildren);
  const allItems = useMemo(() => (loadedItems.length ? [...items, ...loadedItems] : items), [items, loadedItems]);
  const index = useMemo(() => buildFileSystemIndex(allItems), [allItems]);

  const { canGoBack, canGoForward, currentPath, push, step } = useNavigationHistory(defaultPath);

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const selectedEntry = useMemo(() => {
    if (selectedPath === null) return null;
    return index.files.get(selectedPath) ?? index.folders.get(selectedPath) ?? null;
  }, [index, selectedPath]);

  const [searchInput, setSearchInput] = useState('');
  const searchQuery = normalizeSearchQuery(searchInput);

  const [sort, setSort] = useState(DEFAULT_SORT);
  const filterState = useFileSystemFilters(index);
  const { fileFilter } = filterState;

  const visiblePaths = useMemo(
    () => computeVisiblePaths({ currentPath, fileFilter, index, searchQuery }),
    [currentPath, fileFilter, index, searchQuery],
  );
  const visibleIndex = useMemo(() => filterIndexToVisible(index, visiblePaths), [index, visiblePaths]);
  const sortedIndex = useMemo(() => sortIndexChildren(visibleIndex, sort), [sort, visibleIndex]);

  // The ref mirrors the state so re-selecting the same entry (e.g. the
  // press + release pair the columns view emits per tap) stays a no-op without
  // widening the callback's dependencies.
  const selectedPathRef = useRef<string | null>(null);
  const selectEntry = useCallback(
    (entry: FileSystemEntry | null) => {
      const path = entry?.path ?? null;
      if (selectedPathRef.current === path) return;
      selectedPathRef.current = path;
      setSelectedPath(path);
      onSelectionChange?.(entry);
    },
    [onSelectionChange],
  );

  // A query or filter change can hide the selected entry out from under the views.
  // biome-ignore lint/plugin: reacting to the visible set shrinking — the selection lives in state the views own, so it can't be derived during render
  useEffect(() => {
    if (!(visiblePaths && selectedPath)) return;
    if (!visiblePaths.has(selectedPath)) selectEntry(null);
  }, [selectEntry, selectedPath, visiblePaths]);

  const ensureChildren = useCallback(
    (folderPath: string) => {
      const folder = index.folders.get(folderPath);
      if (!folder?.hasChildren) return;
      if (index.children.get(folderPath)?.length) return;
      requestChildren(folderPath);
    },
    [index, requestChildren],
  );

  const navigateTo = useCallback(
    (folderPath: string) => {
      const path = normalizeFolderPath(folderPath);
      push(path);
      // Navigation exits search, like Finder.
      setSearchInput('');
      selectEntry(null);
      ensureChildren(path);
    },
    [ensureChildren, push, selectEntry],
  );

  // biome-ignore lint/plugin: prefetching the opened folder's children is a request keyed on the current path, not derivable render state
  useEffect(() => {
    ensureChildren(currentPath);
  }, [currentPath, ensureChildren]);

  const goBack = useCallback(() => {
    step(-1);
    setSearchInput('');
    selectEntry(null);
  }, [selectEntry, step]);

  const goForward = useCallback(() => {
    step(1);
    setSearchInput('');
    selectEntry(null);
  }, [selectEntry, step]);

  const applySortKey = useCallback((key: FileSystemSortKey) => {
    setSort((previous) => (previous.key === key ? previous : { direction: defaultSortDirection(key), key }));
  }, []);

  // Column headers toggle the direction when the column is already active, like Finder.
  const toggleSortColumn = useCallback((key: FileSystemSortKey) => {
    setSort((previous) =>
      previous.key === key
        ? { direction: previous.direction === 'asc' ? 'desc' : 'asc', key }
        : { direction: defaultSortDirection(key), key },
    );
  }, []);

  // Component-lifetime caches shared by every view and the viewer modal:
  // resolved (e.g. presigned) URLs keyed by path, and lazily loaded page
  // thumbnails keyed by `path#pageIndex`. Lazy state rather than refs — the Maps
  // are passed down during render, which the rules of React disallow for refs.
  const [resolvedUrlCache] = useState(() => new Map<string, string>());
  const [pageUrlCache] = useState(() => new Map<string, string>());

  return {
    ...filterState,
    applySortKey,
    canGoBack,
    canGoForward,
    currentFolderName: currentPath === '' ? title : pathName(currentPath) || title,
    currentPath,
    ensureChildren,
    entries: sortedIndex.children.get(currentPath) ?? [],
    goBack,
    goForward,
    index,
    isLoadingCurrentFolder: loadingFolders.has(currentPath),
    isSearching: searchQuery.length > 0,
    loadingFolders,
    navigateTo,
    pageUrlCache,
    resolvedUrlCache,
    searchInput,
    searchQuery,
    selectedEntry,
    selectedPath,
    selectEntry,
    setSearchInput,
    setView,
    sort,
    sortedIndex,
    toggleSortColumn,
    view,
  };
}

/** Selecting a lazy folder prefetches its children (columns view, keyboard nav). */
export function useSelectAndPrefetch(state: Pick<FileSystemState, 'ensureChildren' | 'selectEntry'>) {
  const { ensureChildren, selectEntry } = state;
  return useCallback(
    (entry: FileSystemEntry | null) => {
      selectEntry(entry);
      if (entry?.kind === 'folder') ensureChildren(entry.path);
    },
    [ensureChildren, selectEntry],
  );
}

/** Type guard used by the views when narrowing a selected entry to a file. */
export function isFileEntry(entry: FileSystemEntry | null): entry is FileEntry {
  return entry?.kind === 'file';
}
