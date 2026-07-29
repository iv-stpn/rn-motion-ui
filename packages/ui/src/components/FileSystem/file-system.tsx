// biome-ignore-all lint/style/noExcessiveLinesPerFile: stories + interaction tests for the whole browser kept together for easy editing
// <FileSystem>: a Finder-style browser over a flat manifest of files.
//
// The component is assembled rather than implemented here — state comes from
// useFileSystem, the toolbar from FileSystemHeader, the file area from
// FileSystemBody — so this module is only the wiring plus the two modals.

import { useCallback, useRef, useState } from 'react';
import type { LayoutChangeEvent, TextInput } from 'react-native';
import { useWindowDimensions, View } from 'react-native';
import { cn } from '../../lib/cn';
import type { FileSystemEntry, FileSystemProps, ResolvedFileSystemBreakpoints } from './file-system.types';
import { defaultFileSystemBreakpoints } from './file-system.types';
import { FileSystemBody } from './file-system-body';
import type { FileSystemContextValue } from './file-system-context';
import { FileSystemContext, useFileSystemContext } from './file-system-context';
import { FileSystemContextMenuProvider } from './file-system-context-menu';
import { FileSystemDateRangeModal } from './file-system-date-range-modal';
import { FileSystemFilterPills } from './file-system-filter-pills';
import { FileSystemHeader } from './file-system-header';
import type { HeaderLayout } from './file-system-toolbar-parts';
import { FileSystemCollapsedSearchRow, FileSystemStatusBar } from './file-system-toolbar-parts';
import { FileSystemViewerModal } from './file-system-viewer-modal';
import { useFileOpen } from './use-file-open';
import { useFileSystem, useSelectAndPrefetch } from './use-file-system';

/** Default viewport height, matching the web original's `h-[480px]`. */
const DEFAULT_HEIGHT = 480;

function headerLayoutForWidth(width: number, breakpoints: ResolvedFileSystemBreakpoints): HeaderLayout {
  if (width < breakpoints.minimal) return 'minimal';
  return width < breakpoints.compact ? 'compact' : 'full';
}

// Renders the consumer's renderHeader render prop, mapping internal state field
// names to the public FileSystemHeaderState shape.
function FileSystemCustomHeader() {
  const ctx = useFileSystemContext();
  if (!ctx.renderHeader) return null;
  const headerTestID = ctx.testID ? `${ctx.testID}-header` : undefined;
  return ctx.renderHeader({
    canGoBack: ctx.canGoBack,
    canGoForward: ctx.canGoForward,
    clearFilters: ctx.clearFilters,
    fileTypeOptions: ctx.fileTypeOptions,
    filters: ctx.filters,
    folderName: ctx.currentFolderName,
    goBack: ctx.goBack,
    goForward: ctx.goForward,
    isCompact: ctx.isCompact,
    isSearchExpanded: ctx.isSearchExpanded,
    layout: ctx.layout,
    openCustomRange: ctx.openDateRangeRequest,
    searchValue: ctx.searchInput,
    selectDatePreset: ctx.setDatePresetFilter,
    setSearchExpanded: ctx.setIsSearchExpanded,
    setSearchValue: ctx.setSearchInput,
    setSortKey: ctx.applySortKey,
    setView: ctx.setView,
    sort: ctx.sort,
    toggleFileType: ctx.toggleFileTypeFilterValue,
    view: ctx.view,
    testID: headerTestID,
  });
}

// Renders the consumer's renderFooter render prop from context.
function FileSystemCustomFooter() {
  const ctx = useFileSystemContext();
  if (!ctx.renderFooter) return null;
  const footerTestID = ctx.testID ? `${ctx.testID}-footer` : undefined;
  return ctx.renderFooter({
    count: ctx.entries.length,
    isSearching: ctx.isSearching,
    selectedName: ctx.selectedEntry?.name,
    testID: footerTestID,
  });
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
  onSelectionChange,
  onViewChange,
  renderBody,
  renderEmptyState,
  renderFilePreview,
  renderFileViewer,
  renderFooter,
  renderHeader,
  title = 'Files',
  view,
  testID,
}: FileSystemProps) {
  const state = useFileSystem({ defaultPath, defaultView, items, loadChildren, onSelectionChange, onViewChange, title, view });
  const selectAndPrefetch = useSelectAndPrefetch(state);

  const urlCache = state.resolvedUrlCache;
  const { closeFile, openFile, opened } = useFileOpen({ getFileUrl, onFileOpen, renderFileViewer, urlCache });

  // The header adapts to the component's own width, not the window's, so it
  // collapses inside a narrow container too. The window width is the first-paint
  // guess until the root has been measured.
  const { width: windowWidth } = useWindowDimensions();
  const [rootWidth, setRootWidth] = useState(0);
  const measuredWidth = rootWidth || windowWidth;
  const handleLayout = useCallback((event: LayoutChangeEvent) => setRootWidth(event.nativeEvent.layout.width), []);

  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<TextInput | null>(null);

  const { navigateTo } = state;
  const openEntry = useCallback(
    (entry: FileSystemEntry) => {
      if (entry.kind === 'folder') navigateTo(entry.path);
      else openFile(entry);
    },
    [navigateTo, openFile],
  );

  const tiers: ResolvedFileSystemBreakpoints = { ...defaultFileSystemBreakpoints, ...breakpoints };
  const layout = headerLayoutForWidth(measuredWidth, tiers);
  const isCompact = measuredWidth < tiers.tablet;
  const isSearchRowVisible = layout !== 'full' && isSearchExpanded;

  const ctxValue: FileSystemContextValue = {
    ...state,
    openEntry,
    selectAndPrefetch,
    layout,
    isCompact,
    isSearchExpanded,
    setIsSearchExpanded,
    searchInputRef,
    closeFile,
    opened,
    draggable,
    getBackgroundContextMenuActions,
    getContextMenuActions,
    getFileUrl,
    loadPreviewImageUrl,
    onBackgroundContextMenuAction,
    onContextMenuAction,
    onMove,
    renderBody,
    renderEmptyState,
    renderFilePreview,
    renderFileViewer,
    renderHeader,
    renderFooter,
    headerClassName,
    bodyClassName,
    footerClassName,
    testID,
  };

  return (
    <FileSystemContext.Provider value={ctxValue}>
      <View className={cn('overflow-hidden bg-background', className)} onLayout={handleLayout} testID={testID} style={{ height }}>
        {renderHeader ? <FileSystemCustomHeader /> : <FileSystemHeader />}
        {isSearchRowVisible ? <FileSystemCollapsedSearchRow /> : null}
        <FileSystemFilterPills />
        <FileSystemContextMenuProvider wideBreakpoint={contextMenuWideBreakpoint}>
          <FileSystemBody />
        </FileSystemContextMenuProvider>
        {renderFooter ? <FileSystemCustomFooter /> : <FileSystemStatusBar />}
        <FileSystemDateRangeModal />
        <FileSystemViewerModal />
      </View>
    </FileSystemContext.Provider>
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
