/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
/** biome-ignore-all lint/style/useComponentExportOnlyModules: the placeholder test id belongs with the node it names */
// The file area: whichever view is active, or the placeholder that replaces it
// when there is nothing to show. The columns view keeps its panes even when the
// current folder is empty — that's how Finder lets you walk back up a trail —
// so it only yields to the placeholder while searching or filtering.
//
// `renderBody` wraps that default content rather than replacing it: the slot
// receives the node and returns a tree containing it, so a consumer can add a
// sidebar or an overlay without reimplementing the four views.
//
// `renderEmptyState` replaces the placeholder itself. Either way the placeholder
// is mounted in the same background surface the list and icons views use, so the
// background context menu opens on the empty area too — that's where a "New
// folder" action matters most.

import { type ComponentType, type ReactNode, useRef } from 'react';
import { Platform, Pressable, View, type ViewStyle } from 'react-native';
import { cn } from '../../lib/cn';
import type { FileSystemBodyState, FileSystemEmptyStateReason, FileSystemView } from './file-system.types';
import { FileSystemColumnsView } from './file-system-columns-view';
import {
  useFileSystemConsumer,
  useFileSystemEntries,
  useFileSystemEntriesActions,
  useFileSystemFilters,
  useFileSystemNavigation,
  useFileSystemSearch,
  useFileSystemSelection,
  useFileSystemSelectionActions,
  useFileSystemViewer,
} from './file-system-context';
import { useBackgroundContextMenu } from './file-system-context-menu';
import { FileSystemGalleryView } from './file-system-gallery-view';
import { FileSystemIconsView } from './file-system-icons-view';
import { FileSystemListView } from './file-system-list-view';
import type { FileSystemViewProps } from './file-system-view';
import { FileSystemEmptyState } from './file-system-view';

const LOADING_LABEL = 'Loading…';
const EMPTY_FOLDER_LABEL = 'This folder is empty';
const NO_FILTER_MATCH_LABEL = 'No items match the active filters';

/**
 * The placeholder's own node — the surface that answers a background
 * right-click / long-press when there is no view to answer it. Fixed rather than
 * derived from the root `testID`, like the drag containers, so a test can reach
 * it untagged.
 */
export const FS_EMPTY_STATE_TEST_ID = 'file-system-empty-state';

const VIEW_COMPONENTS: Record<FileSystemView, ComponentType<FileSystemViewProps>> = {
  columns: FileSystemColumnsView,
  gallery: FileSystemGalleryView,
  icons: FileSystemIconsView,
  list: FileSystemListView,
};

type EmptyStateArgs = { hasActiveFilters: boolean; isLoadingCurrentFolder: boolean; isSearching: boolean };

// Loading wins over the other three: a folder still fetching its children looks
// empty, and saying so would be wrong rather than merely early.
function emptyReason({ hasActiveFilters, isLoadingCurrentFolder, isSearching }: EmptyStateArgs): FileSystemEmptyStateReason {
  if (isLoadingCurrentFolder) return 'loading';
  if (isSearching) return 'no-search-results';
  return hasActiveFilters ? 'no-filter-matches' : 'empty-folder';
}

function emptyLabel(reason: FileSystemEmptyStateReason, searchInput: string): string {
  switch (reason) {
    case 'loading':
      return LOADING_LABEL;
    case 'no-search-results':
      return `No results for “${searchInput.trim()}”`;
    case 'no-filter-matches':
      return NO_FILTER_MATCH_LABEL;
    default:
      return EMPTY_FOLDER_LABEL;
  }
}

type PlaceholderProps = { children: ReactNode };

// The placeholder stands where a view would, so it has to answer a right-click
// the same way — an empty folder is exactly when "New folder" is the action a
// consumer reaches for, and having it work everywhere *except* there would be a
// hole. Same hook the list and icons views use, so one menu closes another.
//
// `tabIndex={-1}` keeps this off the tab ring: it is a surface for a pointer
// gesture, not a control, and anything focusable a consumer renders inside it
// stays reachable regardless.
function FileSystemBodyPlaceholder({ children }: PlaceholderProps) {
  const { currentFolderName } = useFileSystemNavigation();
  const { getBackgroundContextMenuActions, onBackgroundContextMenuAction } = useFileSystemConsumer();
  const containerRef = useRef<View | null>(null);
  const backgroundMenu = useBackgroundContextMenu(
    containerRef,
    getBackgroundContextMenuActions,
    onBackgroundContextMenuAction,
    currentFolderName,
  );

  return (
    <Pressable
      ref={containerRef}
      className="min-h-0 flex-1"
      onLongPress={backgroundMenu.onLongPress}
      tabIndex={-1}
      testID={FS_EMPTY_STATE_TEST_ID}
    >
      {children}
      {backgroundMenu.contextMenuNode}
    </Pressable>
  );
}

/**
 * Placeholder or view, whichever the current state calls for.
 *
 * The views still take their state as props rather than reading the context
 * themselves: `FileSystemViewProps` is one flat contract the four of them share,
 * and the mapping from state field to view prop lives here — `sortedIndex` as
 * `index`, `resolvedUrlCache` as `urlCache`, `toggleSortColumn` as
 * `onSortColumnClick` — so the views stay unaware of how the state is shaped.
 */
function FileSystemBodyContent() {
  const { currentPath, currentFolderName, loadingFolders, isLoadingCurrentFolder } = useFileSystemNavigation();
  const { entries, sortedIndex, sort, view } = useFileSystemEntries();
  const { isSearching, searchInput, searchQuery } = useFileSystemSearch();
  const { hasActiveFilters, fileFilter } = useFileSystemFilters();
  const { selectedEntry, selectedPath } = useFileSystemSelection();
  const { resolvedUrlCache, pageUrlCache } = useFileSystemViewer();
  const {
    draggable,
    getBackgroundContextMenuActions,
    getContextMenuActions,
    getFileUrl,
    loadPreviewImageUrl,
    onBackgroundContextMenuAction,
    onContextMenuAction,
    onMove,
    renderEmptyState,
    renderFilePreview,
    renderFileViewer,
    testID,
  } = useFileSystemConsumer();
  const { openEntry, selectAndPrefetch } = useFileSystemSelectionActions();
  const { toggleSortColumn } = useFileSystemEntriesActions();

  const viewProps: FileSystemViewProps = {
    currentPath,
    draggable,
    entries,
    fileFilter,
    folderName: currentFolderName,
    getBackgroundContextMenuActions,
    getContextMenuActions,
    getFileUrl,
    index: sortedIndex,
    loadingFolders,
    loadPreviewImageUrl,
    onBackgroundContextMenuAction,
    onContextMenuAction,
    onMove,
    onOpen: openEntry,
    onSelect: selectAndPrefetch,
    onSortColumnClick: toggleSortColumn,
    pageUrlCache,
    renderFilePreview,
    renderFileViewer,
    searchQuery,
    selectedEntry,
    selectedPath,
    sort,
    testID,
    urlCache: resolvedUrlCache,
  };

  const isEmpty = entries.length === 0;

  // The columns view keeps its panes over an empty folder so the trail stays
  // walkable, and only yields to the placeholder when a query or a filter is what
  // emptied it — or while the folder is still loading.
  if (isEmpty && (isLoadingCurrentFolder || view !== 'columns' || isSearching || hasActiveFilters)) {
    const reason = emptyReason({ hasActiveFilters, isLoadingCurrentFolder, isSearching });
    const label = emptyLabel(reason, searchInput);
    // `undefined` means "not mine to draw" and falls back to the default, so a
    // slot can take over the empty folder and leave the spinner alone. `null` is
    // a decision, and draws nothing.
    const custom = renderEmptyState?.({
      currentPath,
      folderName: currentFolderName,
      hasActiveFilters,
      isSearching,
      label,
      reason,
      searchValue: searchInput,
      view,
    });
    const placeholder = custom === undefined ? <FileSystemEmptyState isLoading={reason === 'loading'} label={label} /> : custom;

    return <FileSystemBodyPlaceholder>{placeholder}</FileSystemBodyPlaceholder>;
  }

  const ActiveView = VIEW_COMPONENTS[view];
  return <ActiveView {...viewProps} />;
}

// Names in the file area are labels, not prose. Left selectable, a double-click
// would select the word under the cursor, and react-native-web's press responder
// treats that `selectionchange` as a terminated gesture and drops the second
// press — so opening a file by double-clicking its name would silently fail.
// (`userSelect` isn't in RN's ViewStyle and means nothing on native.)
type WebViewStyle = ViewStyle & { userSelect?: string };
const WEB_BODY_STYLE: WebViewStyle | null = Platform.OS === 'web' ? { userSelect: 'none' } : null;

// `testID` is the root's, not the body's: it stays in the props handed to the
// active view so every entry can derive its own id from it (see
// file-system-test-id.ts). The body's own node takes the `-body` suffix.
//
// The wrapper goes inside that node rather than around it, so the file area
// keeps its flex sizing and web selection guard however the consumer nests it.
type FileSystemBodyProps = {
  className?: string;
  renderBody?: (state: FileSystemBodyState & { testID?: string }) => ReactNode;
};

export function FileSystemBody({ className, renderBody }: FileSystemBodyProps) {
  const { currentPath, isLoadingCurrentFolder } = useFileSystemNavigation();
  const { entries, view } = useFileSystemEntries();
  const { hasActiveFilters } = useFileSystemFilters();
  const { isSearching, searchInput } = useFileSystemSearch();
  const { selectedEntry } = useFileSystemSelection();
  const { testID } = useFileSystemConsumer();

  const bodyTestID = testID ? `${testID}-body` : undefined;
  const content = <FileSystemBodyContent />;

  // Called as a plain function rather than rendered as a component, unlike the
  // header and footer slots. An inline `renderBody` arrow is a new function on
  // every render, and a component whose *type* changes remounts its whole
  // subtree — here that subtree is the active view, so every keystroke in the
  // search field would reset its scroll offset, panes and in-flight drag.
  // Calling it keeps the returned elements in the parent's own tree, where
  // reconciliation compares them by position as usual.
  const body = renderBody
    ? renderBody({
        content,
        currentPath,
        entries,
        hasActiveFilters,
        isEmpty: entries.length === 0,
        isLoadingCurrentFolder,
        isSearching,
        searchValue: searchInput,
        selectedEntry,
        testID,
        view,
      })
    : content;

  return (
    <View className={cn('min-h-0 flex-1', className)} style={WEB_BODY_STYLE} testID={bodyTestID}>
      {body}
    </View>
  );
}
