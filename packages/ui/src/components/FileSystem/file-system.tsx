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
import type { FileSystemEntry, FileSystemHeaderState, FileSystemProps, ResolvedFileSystemBreakpoints } from './file-system.types';
import { defaultFileSystemBreakpoints } from './file-system.types';
import { FileSystemBody } from './file-system-body';
import { FileSystemContextMenuProvider } from './file-system-context-menu';
import { FileSystemDateRangeModal } from './file-system-date-range-modal';
import { FILTER_TYPE_LABELS } from './file-system-filter';
import { FileSystemFilterPills } from './file-system-filter-pills';
import { FileSystemHeader } from './file-system-header';
import type { HeaderLayout } from './file-system-toolbar-parts';
import { FileSystemCollapsedSearchRow, FileSystemStatusBar } from './file-system-toolbar-parts';
import { FileSystemViewerModal } from './file-system-viewer-modal';
import { useFileOpen } from './use-file-open';
import { type FileSystemState, useFileSystem, useSelectAndPrefetch } from './use-file-system';

/** Default viewport height, matching the web original's `h-[480px]`. */
const DEFAULT_HEIGHT = 480;

function headerLayoutForWidth(width: number, breakpoints: ResolvedFileSystemBreakpoints): HeaderLayout {
  if (width < breakpoints.minimal) return 'minimal';
  return width < breakpoints.compact ? 'compact' : 'full';
}

type HeaderRedenderProps = {
  renderHeader: (state: FileSystemHeaderState & { testID?: string }) => React.ReactNode;
  state: FileSystemState;
  layout: HeaderLayout;
  isSearchExpanded: boolean;
  setIsSearchExpanded: (expanded: boolean) => void;
  isCompact: boolean;
  testID?: string;
};
function HeaderRenderer({ renderHeader: Header, state, layout, ...props }: HeaderRedenderProps) {
  const {
    currentFolderName,
    searchInput,
    setSearchInput,
    applySortKey,
    setFilterOperator,
    setFilterDatePreset,
    toggleFileTypeFilterValue,
    openDateRangeRequest,
    setDatePresetFilter,
    ...stateProps
  } = state;
  return (
    <Header
      {...stateProps}
      folderName={currentFolderName}
      searchValue={searchInput}
      setSearchValue={setSearchInput}
      openCustomRange={openDateRangeRequest}
      selectDatePreset={setDatePresetFilter}
      setSortKey={applySortKey}
      toggleFileType={toggleFileTypeFilterValue}
      isSearchExpanded={props.isSearchExpanded}
      setSearchExpanded={props.setIsSearchExpanded}
      layout={layout}
      isCompact={props.isCompact}
      testID={props.testID}
    />
  );
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: the root is wiring — state in, four regions and two modals out; splitting it would only add indirection
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
  renderFilePreview,
  renderFileViewer,
  renderFooter: CustomFooter,
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

  const { applyCustomDateRange, closeDateRangeRequest, dateRangeRequest } = state;
  const handleApplyDateRange = useCallback(
    (from: Date, to: Date) => {
      if (!dateRangeRequest) return;
      applyCustomDateRange(dateRangeRequest.type, from, to);
      closeDateRangeRequest();
    },
    [applyCustomDateRange, closeDateRangeRequest, dateRangeRequest],
  );

  const tiers: ResolvedFileSystemBreakpoints = { ...defaultFileSystemBreakpoints, ...breakpoints };
  const layout = headerLayoutForWidth(measuredWidth, tiers);
  const isCompact = measuredWidth < tiers.tablet;
  const isSearchRowVisible = layout !== 'full' && isSearchExpanded;
  const selectedName = state.selectedEntry?.name;

  const headerTestID = testID ? `${testID}-header` : undefined;
  const footerTestID = testID ? `${testID}-footer` : undefined;

  return (
    <View className={cn('overflow-hidden bg-background', className)} onLayout={handleLayout} testID={testID} style={{ height }}>
      {renderHeader ? (
        <HeaderRenderer
          renderHeader={renderHeader}
          state={state}
          layout={layout}
          isSearchExpanded={isSearchExpanded}
          setIsSearchExpanded={setIsSearchExpanded}
          isCompact={isCompact}
          testID={headerTestID}
        />
      ) : (
        <FileSystemHeader
          canGoBack={state.canGoBack}
          canGoForward={state.canGoForward}
          className={headerClassName}
          fileTypeOptions={state.fileTypeOptions}
          filters={state.filters}
          folderName={state.currentFolderName}
          isCompact={isCompact}
          isSearchExpanded={isSearchExpanded}
          layout={layout}
          onGoBack={state.goBack}
          onGoForward={state.goForward}
          onOpenCustomRange={state.openDateRangeRequest}
          onSearchChange={state.setSearchInput}
          onSearchExpandedChange={setIsSearchExpanded}
          onSelectDatePreset={state.setDatePresetFilter}
          onSortKeyChange={state.applySortKey}
          onToggleFileType={state.toggleFileTypeFilterValue}
          onViewChange={state.setView}
          searchInputRef={searchInputRef}
          searchValue={state.searchInput}
          sort={state.sort}
          view={state.view}
          testID={headerTestID}
        />
      )}
      {isSearchRowVisible ? (
        <FileSystemCollapsedSearchRow inputRef={searchInputRef} onValueChange={state.setSearchInput} value={state.searchInput} />
      ) : null}
      <FileSystemFilterPills
        fileTypeOptions={state.fileTypeOptions}
        filters={state.filters}
        onClearFilters={state.clearFilters}
        onOpenCustomRange={state.openDateRangeRequest}
        onOperatorChange={state.setFilterOperator}
        onRemove={state.removeFilter}
        onSelectDatePreset={state.setFilterDatePreset}
        onToggleFileType={state.toggleFileTypeFilterValue}
      />
      <FileSystemContextMenuProvider wideBreakpoint={contextMenuWideBreakpoint}>
        <FileSystemBody
          className={bodyClassName}
          currentPath={state.currentPath}
          draggable={draggable}
          entries={state.entries}
          fileFilter={state.fileFilter}
          getBackgroundContextMenuActions={getBackgroundContextMenuActions}
          getContextMenuActions={getContextMenuActions}
          getFileUrl={getFileUrl}
          hasActiveFilters={state.hasActiveFilters}
          index={state.sortedIndex}
          isLoadingCurrentFolder={state.isLoadingCurrentFolder}
          isSearching={state.isSearching}
          loadPreviewImageUrl={loadPreviewImageUrl}
          loadingFolders={state.loadingFolders}
          onBackgroundContextMenuAction={onBackgroundContextMenuAction}
          onContextMenuAction={onContextMenuAction}
          onMove={onMove}
          onOpen={openEntry}
          onSelect={selectAndPrefetch}
          onSortColumnClick={state.toggleSortColumn}
          pageUrlCache={state.pageUrlCache}
          renderBody={renderBody}
          renderFilePreview={renderFilePreview}
          renderFileViewer={renderFileViewer}
          searchInput={state.searchInput}
          searchQuery={state.searchQuery}
          selectedEntry={state.selectedEntry}
          selectedPath={state.selectedPath}
          sort={state.sort}
          urlCache={state.resolvedUrlCache}
          view={state.view}
          testID={testID}
        />
      </FileSystemContextMenuProvider>
      {CustomFooter ? (
        <CustomFooter
          count={state.entries.length}
          isSearching={state.isSearching}
          selectedName={selectedName}
          testID={footerTestID}
        />
      ) : (
        <FileSystemStatusBar
          className={footerClassName}
          count={state.entries.length}
          isSearching={state.isSearching}
          selectedName={selectedName}
          testID={footerTestID}
        />
      )}
      <FileSystemDateRangeModal
        initialRange={dateRangeRequest?.initialRange}
        onApply={handleApplyDateRange}
        onClose={closeDateRangeRequest}
        open={dateRangeRequest !== null}
        title={dateRangeRequest ? FILTER_TYPE_LABELS[dateRangeRequest.type] : undefined}
      />
      <FileSystemViewerModal
        getFileUrl={getFileUrl}
        loadPreviewImageUrl={loadPreviewImageUrl}
        onClose={closeFile}
        opened={opened}
        pageUrlCache={state.pageUrlCache}
        renderFilePreview={renderFilePreview}
        renderFileViewer={renderFileViewer}
        urlCache={state.resolvedUrlCache}
      />
    </View>
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
