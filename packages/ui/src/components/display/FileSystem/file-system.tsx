/** biome-ignore-all lint/style/noExcessiveLinesPerFile: assembly point — store init, 4 render-prop adapters, layout sync and public re-exports all belong here */
// <FileSystem>: assembly point — creates the per-instance Zustand store, syncs
// consumer props into it, and renders the context provider with all regions.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { useWindowDimensions, View } from 'react-native';
import { cn } from '../../../lib/cn';
import type { FileSystemProps, ResolvedFileSystemBreakpoints } from './file-system.types';
import { defaultFileSystemBreakpoints } from './file-system.types';
import { FileSystemBody } from './file-system-body';
import { FileSystemBreadcrumbs } from './file-system-breadcrumbs';
import {
  createFileSystemStore,
  type FileSystemStoreApi,
  FileSystemStoreContext,
  useFileSystemConsumer,
  useFileSystemEntries,
  useFileSystemEntriesActions,
  useFileSystemFilterActions,
  useFileSystemFilters,
  useFileSystemLayout,
  useFileSystemNavigation,
  useFileSystemNavigationActions,
  useFileSystemSearch,
  useFileSystemSearchActions,
  useFileSystemSelection,
  useFileSystemSelectionActions,
  useFileSystemStoreContext,
} from './file-system-context';
import { FileSystemContextMenuProvider } from './file-system-context-menu';
import { FileSystemDateRangeModal } from './file-system-date-range-modal';
import { FileSystemHeader } from './file-system-header';
import type { HeaderLayout } from './file-system-toolbar-parts';
import { FileSystemStatusBar } from './file-system-toolbar-parts';
import { FileSystemViewerModal } from './file-system-viewer-modal';

/** Default viewport height, matching the web original's `h-[480px]`. */
const DEFAULT_HEIGHT = 480;

function headerLayoutForWidth(width: number, breakpoints: ResolvedFileSystemBreakpoints): HeaderLayout {
  if (width < breakpoints.minimal) return 'minimal';
  return width < breakpoints.compact ? 'compact' : 'full';
}

type FileSystemCustomHeaderProps = { renderHeader: NonNullable<FileSystemProps['renderHeader']> };

// Renders the consumer's renderHeader render prop, mapping slice state to the
// public FileSystemHeaderState shape.
function FileSystemCustomHeader({ renderHeader }: FileSystemCustomHeaderProps) {
  const { currentFolderName, canGoBack, canGoForward } = useFileSystemNavigation();
  const { view, sort } = useFileSystemEntries();
  const { searchInput } = useFileSystemSearch();
  const { layout, isCompact } = useFileSystemLayout();
  const { testID } = useFileSystemConsumer();
  const { goBack, goForward } = useFileSystemNavigationActions();
  const { setView, applySortKey } = useFileSystemEntriesActions();
  const { setSearchInput } = useFileSystemSearchActions();
  return renderHeader({
    canGoBack,
    canGoForward,
    folderName: currentFolderName,
    goBack,
    goForward,
    isCompact,
    layout,
    searchValue: searchInput,
    setSearchValue: setSearchInput,
    setSortKey: applySortKey,
    setView,
    sort,
    view,
    testID: testID ? `${testID}-header` : undefined,
  });
}

type FileSystemCustomFooterProps = { renderFooter: NonNullable<FileSystemProps['renderFooter']> };

// Renders the consumer's renderFooter render prop from slice state.
function FileSystemCustomFooter({ renderFooter }: FileSystemCustomFooterProps) {
  const { entries } = useFileSystemEntries();
  const { isSearching } = useFileSystemSearch();
  const { selectedEntry, selectedPaths } = useFileSystemSelection();
  const { testID } = useFileSystemConsumer();
  const { clearSelection } = useFileSystemSelectionActions();
  return renderFooter({
    clearSelection,
    count: entries.length,
    isSearching,
    selectedCount: selectedPaths.size,
    selectedName: selectedEntry?.name,
    testID: testID ? `${testID}-footer` : undefined,
  });
}

type FileSystemCustomFiltersProps = { renderFilters: NonNullable<FileSystemProps['renderFilters']> };

// Renders the consumer's renderFilters render prop, mapping slice state to the
// public FileSystemFiltersState shape.
function FileSystemCustomFilters({ renderFilters }: FileSystemCustomFiltersProps) {
  const { entries, sort } = useFileSystemEntries();
  const { searchInput, isSearching } = useFileSystemSearch();
  const { filters, fileTypeOptions, hasActiveFilters } = useFileSystemFilters();
  const { testID } = useFileSystemConsumer();
  const { applySortKey } = useFileSystemEntriesActions();
  const { setSearchInput } = useFileSystemSearchActions();
  const { clearFilters, toggleFileTypeFilterValue, openDateRangeRequest, setDatePresetFilter } = useFileSystemFilterActions();
  return renderFilters({
    clearFilters,
    count: entries.length,
    fileTypeOptions,
    filters,
    hasActiveFilters,
    isSearching,
    openCustomRange: openDateRangeRequest,
    searchValue: searchInput,
    selectDatePreset: setDatePresetFilter,
    setSearchValue: setSearchInput,
    setSortKey: applySortKey,
    sort,
    toggleFileType: toggleFileTypeFilterValue,
    testID: testID ? `${testID}-filters` : undefined,
  });
}

// Null-rendering component that subscribes to store path changes and triggers
// ensureChildren — kept separate so FileSystem itself never re-renders on
// navigation state changes.
function FileSystemSideEffects() {
  const store = useFileSystemStoreContext();
  // biome-ignore lint/plugin: subscribing to store for path-driven lazy loading
  useEffect(() => {
    const {
      navigation: { currentPath },
      ensureChildren,
    } = store.getState();
    ensureChildren(currentPath);
    return store.subscribe((s, prev) => {
      if (s.navigation.currentPath !== prev.navigation.currentPath) store.getState().ensureChildren(s.navigation.currentPath);
    });
  }, [store]);
  return null;
}

export function FileSystem({
  bodyClassName,
  breakpoints,
  className,
  contextMenuWideBreakpoint,
  defaultPath = '',
  defaultView = 'icons',
  draggable,
  footerClassName,
  getBackgroundContextMenuActions,
  getContextMenuActions,
  getFileUrl,
  headerClassName,
  height = DEFAULT_HEIGHT,
  items,
  loadChildren,
  loadPreviewImageUrl,
  onBackgroundContextMenuAction,
  onContextMenuAction,
  onFileOpen,
  onMove,
  onSelectedItemsChange,
  onSelectionChange,
  onViewChange,
  renderBody,
  renderEmptyState,
  renderFilePreview,
  renderFileViewer,
  renderFilters,
  renderFooter,
  renderHeader,
  selectionMode = 'single',
  title = 'Files',
  view,
  testID,
}: FileSystemProps) {
  // Create ONE store per mount; never recreate on re-render.
  const storeRef = useRef<FileSystemStoreApi | null>(null);
  if (storeRef.current === null)
    storeRef.current = createFileSystemStore({
      items,
      title,
      defaultPath,
      defaultView,
      draggable,
      getBackgroundContextMenuActions,
      getContextMenuActions,
      getFileUrl,
      loadChildren,
      loadPreviewImageUrl,
      onBackgroundContextMenuAction,
      onContextMenuAction,
      onFileOpen,
      onMove,
      onSelectedItemsChange,
      onSelectionChange,
      onViewChange,
      renderEmptyState,
      renderFilePreview,
      renderFileViewer,
      selectionMode,
      testID,
    });
  const store = storeRef.current;

  // Sync items into the store when the prop changes.
  // biome-ignore lint/plugin: syncing external items prop into Zustand store
  useEffect(() => {
    store.getState()._setItems(items);
  }, [store, items]);

  // Sync all consumer callbacks on every render — no deps array is intentional.
  // _syncConsumer short-circuits with a shallow-equal check so it's idempotent.
  // biome-ignore lint/plugin: intentional no-deps sync on every render
  useEffect(() => {
    store.getState()._syncConsumer({
      title,
      draggable,
      getBackgroundContextMenuActions,
      getContextMenuActions,
      getFileUrl,
      loadChildren,
      loadPreviewImageUrl,
      onBackgroundContextMenuAction,
      onContextMenuAction,
      onFileOpen,
      onMove,
      onSelectedItemsChange,
      onSelectionChange,
      onViewChange,
      renderEmptyState,
      renderFilePreview,
      renderFileViewer,
      selectionMode,
      testID,
    });
  });

  // Layout: adapt the header to the component's own width, not the window's.
  // The window width is the first-paint guess until the root has been measured.
  const { width: windowWidth } = useWindowDimensions();
  const [rootWidth, setRootWidth] = useState(0);
  const measuredWidth = rootWidth || windowWidth;
  const handleLayout = useCallback((event: LayoutChangeEvent) => setRootWidth(event.nativeEvent.layout.width), []);
  const tiers: ResolvedFileSystemBreakpoints = { ...defaultFileSystemBreakpoints, ...breakpoints };
  const layout = headerLayoutForWidth(measuredWidth, tiers);
  const isCompact = measuredWidth < tiers.tablet;

  // biome-ignore lint/plugin: syncing layout into store
  useEffect(() => {
    store.getState()._syncLayout({ layout, isCompact });
  }, [store, layout, isCompact]);

  // Sync the controlled `view` prop when provided.
  // biome-ignore lint/plugin: syncing controlled view prop into store
  useEffect(() => {
    if (view !== undefined) store.getState().setView(view);
  }, [store, view]);

  return (
    <FileSystemStoreContext.Provider value={store}>
      <View className={cn('overflow-hidden bg-background', className)} onLayout={handleLayout} testID={testID} style={{ height }}>
        {renderHeader ? <FileSystemCustomHeader renderHeader={renderHeader} /> : <FileSystemHeader className={headerClassName} />}
        <FileSystemBreadcrumbs />
        {renderFilters ? <FileSystemCustomFilters renderFilters={renderFilters} /> : null}
        <FileSystemContextMenuProvider wideBreakpoint={contextMenuWideBreakpoint}>
          <FileSystemBody className={bodyClassName} renderBody={renderBody} />
        </FileSystemContextMenuProvider>
        {renderFooter ? (
          <FileSystemCustomFooter renderFooter={renderFooter} />
        ) : (
          <FileSystemStatusBar className={footerClassName} />
        )}
        <FileSystemDateRangeModal />
        <FileSystemViewerModal />
        <FileSystemSideEffects />
      </View>
    </FileSystemStoreContext.Provider>
  );
}

// ── Public surface ─────────────────────────────────────────────────────────
// `file-system.tsx` is the package entry point (see package.json →
// "./file-system"), so it re-exports every type a consumer touches: the props,
// the manifest shapes their `items` are built from, and the argument types their
// callbacks receive. The logic modules, the toolbar parts and the four views
// stay internal.
export type {
  FileEntry,
  FileSystemBodyState,
  FileSystemContextMenuAction,
  FileSystemEmptyStateArgs,
  FileSystemEmptyStateReason,
  FileSystemEntry,
  FileSystemFileItem,
  FileSystemFilter,
  FileSystemFilterOperator,
  FileSystemFiltersState,
  FileSystemFilterType,
  FileSystemFolderItem,
  FileSystemHeaderState,
  FileSystemIndex,
  FileSystemItem,
  FileSystemLoadChildrenArgs,
  FileSystemLoadChildrenResult,
  FileSystemMoveEvent,
  FileSystemProps,
  FileSystemSortDirection,
  FileSystemSortKey,
  FileSystemSortState,
  FileSystemStatusState,
  FileSystemView,
  FileSystemViewerArgs,
  FileSystemViewerKind,
  FileTypeFilterGroup,
  FileTypeFilterOption,
  FolderEntry,
} from './file-system.types';
export type {
  FileSystemSelectionMode,
  FileSystemSelectionModifiers,
} from './file-system-selection';
