/** biome-ignore-all lint/style/noExcessiveLinesPerFile: assembly point — store init, 4 render-prop adapters, the breadcrumb binding, layout sync and public re-exports all belong here */
// <FileSystem>: assembly point — creates the per-instance Zustand store, syncs
// consumer props into it, and renders the context provider with all regions.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { useColorScheme, useWindowDimensions, View } from 'react-native';
import { cn } from '../../../lib/cn';
import { Breadcrumbs } from '../../display/Breadcrumbs/breadcrumbs';
import { HoldMenuProvider } from '../../menus/HoldMenu/hold-menu';
import { buildCrumbs } from './logic/file-system-search';
import { FileSystemDragScope } from './shell/file-system-drag-scope';
import { FileSystemHeader } from './shell/file-system-header';
import type { HeaderLayout } from './shell/file-system-toolbar-parts';
import { FileSystemStatusBar } from './shell/file-system-toolbar-parts';
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
  useFileSystemViewActions,
} from './store/file-system-context';
import type { FileSystemBreadcrumb, FileSystemProps, ResolvedFileSystemBreakpoints } from './types/file-system.types';
import { defaultFileSystemBreakpoints } from './types/file-system.types';
import { FileSystemBody } from './views/file-system-body';
import { FileSystemViewerModal } from './views/file-system-viewer-modal';

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
  const { applySortKey } = useFileSystemEntriesActions();
  const { setView } = useFileSystemViewActions();
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
  const { currentFolderName, currentPath } = useFileSystemNavigation();
  const { searchInput, isSearching, scope } = useFileSystemSearch();
  const { filters, fileTypeOptions, hasActiveFilters } = useFileSystemFilters();
  const { rootLabel, testID } = useFileSystemConsumer();
  const { applySortKey } = useFileSystemEntriesActions();
  const { setSearchInput, setSearchScope } = useFileSystemSearchActions();
  const {
    applyCustomDateRange,
    clearFilters,
    removeFilter,
    setDatePresetFilter,
    setFilterDatePreset,
    setFilterOperator,
    toggleFileTypeFilterValue,
  } = useFileSystemFilterActions();

  return renderFilters({
    applyCustomRange: applyCustomDateRange,
    clearFilters,
    count: entries.length,
    fileTypeOptions,
    filters,
    folderName: currentFolderName,
    hasActiveFilters,
    isAtRoot: currentPath === '',
    isSearching,
    removeFilter,
    rootLabel,
    searchScope: scope,
    searchValue: searchInput,
    selectDatePreset: setDatePresetFilter,
    setFilterDatePreset,
    setFilterOperator,
    setSearchScope,
    setSearchValue: setSearchInput,
    setSortKey: applySortKey,
    sort,
    toggleFileType: toggleFileTypeFilterValue,
    testID: testID ? `${testID}-filters` : undefined,
  });
}

// `buildCrumbs` keys each crumb by its folder path, which is exactly what
// `navigateTo` takes — it normalizes the trailing slash itself. Re-keyed to
// `id` so a consumer can hand `crumbs` straight to its own breadcrumb UI.
function crumbsForPath(currentPath: string, rootLabel: string): FileSystemBreadcrumb[] {
  return buildCrumbs(currentPath, rootLabel).map((crumb) => ({ id: crumb.key, label: crumb.label }));
}

type FileSystemCustomBreadcrumbsProps = { renderBreadcrumbs: NonNullable<FileSystemProps['renderBreadcrumbs']> };

// Renders the consumer's renderBreadcrumbs render prop from slice state.
function FileSystemCustomBreadcrumbs({ renderBreadcrumbs }: FileSystemCustomBreadcrumbsProps) {
  const { currentPath } = useFileSystemNavigation();
  const { rootLabel, testID } = useFileSystemConsumer();
  const { navigateTo } = useFileSystemNavigationActions();
  const crumbs = useMemo(() => crumbsForPath(currentPath, rootLabel), [currentPath, rootLabel]);
  return renderBreadcrumbs({
    crumbs,
    currentPath,
    navigateTo,
    testID: testID ? `${testID}-breadcrumbs` : undefined,
  });
}

type FileSystemBreadcrumbsProps = { className?: string };

// Binds the generic <Breadcrumbs> to the store: folder paths in, navigation out.
// Hidden at the root — the header already names it, and there is no trail back.
// The search view builds its own per-row trails from the same `buildCrumbs`.
function FileSystemBreadcrumbs({ className }: FileSystemBreadcrumbsProps) {
  const { currentPath } = useFileSystemNavigation();
  const { rootLabel, testID } = useFileSystemConsumer();
  const { navigateTo } = useFileSystemNavigationActions();

  const items = useMemo(() => crumbsForPath(currentPath, rootLabel), [currentPath, rootLabel]);

  if (!currentPath) return null;

  return (
    <Breadcrumbs
      className={className}
      items={items}
      onNavigate={navigateTo}
      testID={testID ? `${testID}-breadcrumbs` : undefined}
    />
  );
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
  breadcrumbsClassName,
  breakpoints,
  className,
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
  onExternalDrop,
  onFileOpen,
  onMove,
  onSelectedItemsChange,
  onSelectionChange,
  onViewChange,
  renderBody,
  renderBreadcrumbs,
  renderEmptyState,
  renderEntryIcon,
  renderFilePreview,
  renderFileViewer,
  renderFilters,
  renderFooter,
  renderHeader,
  rootLabel,
  selectionMode = 'single',
  title = 'Files',
  view,
  views,
  testID,
}: FileSystemProps) {
  // The breadcrumb root falls back to the header title, so the trail names the
  // root the same way the header does unless a consumer says otherwise.
  const resolvedRootLabel = rootLabel ?? title;

  // Create ONE store per mount; never recreate on re-render.
  const storeRef = useRef<FileSystemStoreApi | null>(null);
  if (storeRef.current === null)
    storeRef.current = createFileSystemStore({
      items,
      title,
      rootLabel: resolvedRootLabel,
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
      onExternalDrop,
      onFileOpen,
      onMove,
      onSelectedItemsChange,
      onSelectionChange,
      onViewChange,
      renderEmptyState,
      renderEntryIcon,
      renderFilePreview,
      renderFileViewer,
      selectionMode,
      testID,
      views,
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
      rootLabel: resolvedRootLabel,
      draggable,
      getBackgroundContextMenuActions,
      getContextMenuActions,
      getFileUrl,
      loadChildren,
      loadPreviewImageUrl,
      onBackgroundContextMenuAction,
      onContextMenuAction,
      onExternalDrop,
      onFileOpen,
      onMove,
      onSelectedItemsChange,
      onSelectionChange,
      onViewChange,
      renderEmptyState,
      renderEntryIcon,
      renderFilePreview,
      renderFileViewer,
      selectionMode,
      testID,
      views,
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
  const colorScheme = useColorScheme();

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
        {renderBreadcrumbs ? (
          <FileSystemCustomBreadcrumbs renderBreadcrumbs={renderBreadcrumbs} />
        ) : (
          <FileSystemBreadcrumbs className={breadcrumbsClassName} />
        )}
        {renderFilters ? <FileSystemCustomFilters renderFilters={renderFilters} /> : null}
        {/* Around the body alone: everything that drags or receives a drop is in
            there, and the manager's box is the frame its ghost is drawn in — a
            frame that included the header would let a ghost float over the
            toolbar, which is not a place anything can be dropped. The hold menu's
            provider wraps the same region so its portal host (backdrop, twin,
            panel) anchors to the file area rather than the whole component. */}
        <FileSystemDragScope>
          <HoldMenuProvider theme={colorScheme === 'dark' ? 'dark' : 'light'}>
            <FileSystemBody className={bodyClassName} renderBody={renderBody} />
          </HoldMenuProvider>
        </FileSystemDragScope>
        {renderFooter ? (
          <FileSystemCustomFooter renderFooter={renderFooter} />
        ) : (
          <FileSystemStatusBar className={footerClassName} />
        )}
        <FileSystemViewerModal />
        <FileSystemSideEffects />
      </View>
    </FileSystemStoreContext.Provider>
  );
}

export type { FileSystemSelectionMode, FileSystemSelectionModifiers } from './logic/file-system-selection';
// biome-ignore lint/performance/noBarrelFile: this file is the package entry point — re-exporting the view hooks is the public API, not a lazy barrel
export { useFileSystemView, useFileSystemViewActions } from './store/file-system-context';
// ── Public surface ─────────────────────────────────────────────────────────
// `file-system.tsx` is the package entry point (see package.json →
// "./file-system"), so it re-exports every type a consumer touches: the props,
// the manifest shapes their `items` are built from, and the argument types their
// callbacks receive. The logic modules, the toolbar parts and the four views
// stay internal.
export type {
  FileEntry,
  FileSystemBodyState,
  FileSystemBreadcrumb,
  FileSystemBreadcrumbsState,
  FileSystemBuiltInView,
  FileSystemContextMenuAction,
  FileSystemEmptyStateArgs,
  FileSystemEmptyStateReason,
  FileSystemEntry,
  FileSystemExternalDropEvent,
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
  FileSystemSearchScope,
  FileSystemSortDirection,
  FileSystemSortKey,
  FileSystemSortState,
  FileSystemStatusState,
  FileSystemView,
  FileSystemViewerArgs,
  FileSystemViewerKind,
  FileSystemViewProps,
  FileTypeFilterGroup,
  FileTypeFilterOption,
  FolderEntry,
} from './types/file-system.types';
