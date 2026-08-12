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

import { type ComponentType, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { cn } from '../../../lib/cn';
import type { DragzoneRenderState } from '../../gestures/drag.types';
import type { FileSystemBodyState, FileSystemEmptyStateReason, FileSystemView } from './file-system.types';
import { FileSystemColumnsView } from './file-system-columns-view';
import {
  useFileSystemConsumer,
  useFileSystemEntries,
  useFileSystemEntriesActions,
  useFileSystemFilters,
  useFileSystemNavigation,
  useFileSystemNavigationActions,
  useFileSystemSearch,
  useFileSystemSelection,
  useFileSystemSelectionActions,
  useFileSystemViewer,
} from './file-system-context';
import { useBackgroundContextMenu } from './file-system-context-menu';
import { FileSystemDropzone } from './file-system-dropzone';
import { FileSystemGalleryView } from './file-system-gallery-view';
import { FileSystemIconsView } from './file-system-icons-view';
import { FileSystemListView } from './file-system-list-view';
import { FileSystemSearchView } from './file-system-search-view';
import type { FileSystemViewProps } from './file-system-view';
import { FileSystemEmptyState } from './file-system-view';

const LOADING_LABEL = 'Loading…';
const EMPTY_FOLDER_LABEL = 'This folder is empty';
const NO_FILTER_MATCH_LABEL = 'No items match the active filters';
const EXTERNAL_DROP_LABEL = 'Drop to add';

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

type EmptyStateArgs = { hasActiveFilters: boolean; isLoading: boolean; isSearching: boolean };

// Loading wins over the other three: a folder still fetching its children looks
// empty, and saying so would be wrong rather than merely early.
function emptyReason({ hasActiveFilters, isLoading, isSearching }: EmptyStateArgs): FileSystemEmptyStateReason {
  if (isLoading) return 'loading';
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
  const { getBackgroundContextMenuActions, onBackgroundContextMenuAction } = useFileSystemConsumer();
  const containerRef = useRef<View | null>(null);
  const { onLongPress: bgLongPress, menuNode: bgMenuNode } = useBackgroundContextMenu(
    containerRef,
    getBackgroundContextMenuActions,
    onBackgroundContextMenuAction,
  );

  return (
    <Pressable
      ref={containerRef}
      className="min-h-0 flex-1"
      onLongPress={bgLongPress}
      tabIndex={-1}
      testID={FS_EMPTY_STATE_TEST_ID}
    >
      {children}
      {bgMenuNode}
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
  const { currentPath, currentFolderName: folderName, errorFolders, loadingFolders, isLoading } = useFileSystemNavigation();
  const { entries, sortedIndex, sort, view } = useFileSystemEntries();
  const { isSearching, searchInput: searchValue, searchQuery } = useFileSystemSearch();
  const { hasActiveFilters, fileFilter } = useFileSystemFilters();
  const { selectedEntry, selectedPath, selectedPaths } = useFileSystemSelection();
  const { resolvedUrlCache, pageUrlCache } = useFileSystemViewer();
  const {
    draggable,
    getBackgroundContextMenuActions,
    getContextMenuActions,
    getFileUrl,
    loadPreviewImageUrl,
    onBackgroundContextMenuAction,
    onContextMenuAction,
    onExternalDrop,
    onMove,
    renderEmptyState,
    renderEntryIcon,
    renderFilePreview,
    renderFileViewer,
    rootLabel,
    selectionMode,
    testID,
  } = useFileSystemConsumer();
  const { openEntry, selectAndPrefetch, selectMarquee } = useFileSystemSelectionActions();
  const { ensureChildren } = useFileSystemNavigationActions();
  const { toggleSortColumn } = useFileSystemEntriesActions();

  const viewProps: FileSystemViewProps = {
    currentPath,
    draggable,
    ensureChildren,
    entries,
    errorFolders,
    fileFilter,
    folderName,
    getBackgroundContextMenuActions,
    getContextMenuActions,
    getFileUrl,
    index: sortedIndex,
    loadingFolders,
    loadPreviewImageUrl,
    onBackgroundContextMenuAction,
    onContextMenuAction,
    onExternalDrop,
    onMarquee: selectMarquee,
    onMove,
    onOpen: openEntry,
    onSelect: selectAndPrefetch,
    onSortColumnClick: toggleSortColumn,
    pageUrlCache,
    renderEntryIcon,
    renderFilePreview,
    renderFileViewer,
    rootLabel,
    searchQuery,
    selectedEntry,
    selectedPath,
    selectedPaths,
    selectionMode,
    sort,
    testID,
    urlCache: resolvedUrlCache,
  };

  const isEmpty = entries.length === 0;

  // The columns view keeps its panes over an empty folder so the trail stays
  // walkable, and only yields to the placeholder when a query or a filter is what
  // emptied it — or while the folder is still loading.
  if (isEmpty && (isLoading || view !== 'columns' || isSearching || hasActiveFilters)) {
    const reason = emptyReason({ hasActiveFilters, isLoading, isSearching });
    const label = emptyLabel(reason, searchValue);
    const isEmptyStateLoading = reason === 'loading';

    // `undefined` means "not mine to draw" and falls back to the default, so a
    // slot can take over the empty folder and leave the spinner alone. `null` is
    // a decision, and draws nothing.
    const emptyStateConfig = { currentPath, folderName, hasActiveFilters, isSearching, label, reason, searchValue, view };
    const custom = renderEmptyState?.(emptyStateConfig);
    const placeholder = custom === undefined ? <FileSystemEmptyState isLoading={isEmptyStateLoading} label={label} /> : custom;
    return <FileSystemBodyPlaceholder>{placeholder}</FileSystemBodyPlaceholder>;
  }

  const ActiveView = isSearching ? FileSystemSearchView : VIEW_COMPONENTS[view];
  return <ActiveView {...viewProps} />;
}

/**
 * Loses to every zone inside it — a folder row, a tile, a column — so the body
 * only takes a drop nothing more specific wanted. One step below the columns
 * view's own pane fallback, which is itself already negative.
 */
const BODY_ZONE_PRIORITY = -2;

// Drawn over the file area while a drag bound for the current folder hovers it.
// Absolute so it never displaces the view; `pointer-events-none` so the drag
// events the zone reads keep arriving. The label is for an external payload only:
// a drag from inside carries entries the view is already showing, and captioning
// the whole area says less than the ring on the folder under the pointer.
type BodyDropSurfaceProps = { external: boolean };

function BodyDropSurface({ external }: BodyDropSurfaceProps) {
  return (
    <View
      className={cn(
        'pointer-events-none absolute inset-0 z-[3]',
        external
          ? 'items-center justify-center border border-foreground/20 border-dashed bg-foreground/[0.03]'
          : 'rounded-lg border-2 border-info',
      )}
    >
      {external ? (
        <Text className="font-medium text-foreground/50 text-sm" selectable={false}>
          {EXTERNAL_DROP_LABEL}
        </Text>
      ) : null}
    </View>
  );
}

// How long an in-library hover must hold before the whole-area ring paints. The
// body is the fallback zone, so during a drag's opening frame it owns the pointer
// while the overlay dropzones of an expanded folder tree mount and measure — and
// without this gate, its outline flashes under the pointer before the deepest
// folder's overlay takes over. External drops have no overlays to wait for, so
// their surface paints at once.
const BODY_OUTLINE_DELAY_MS = 100;

type GatedBodyDropSurfaceProps = { external: boolean; isOver: boolean };

function GatedBodyDropSurface({ external, isOver }: GatedBodyDropSurfaceProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isOver) {
      setVisible(false);
      return;
    }
    if (external) {
      setVisible(true);
      return;
    }
    const timer = setTimeout(() => setVisible(true), BODY_OUTLINE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [external, isOver]);

  return visible ? <BodyDropSurface external={external} /> : null;
}

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
  const { currentPath, isLoading } = useFileSystemNavigation();
  const { entries, sortedIndex, view } = useFileSystemEntries();
  const { hasActiveFilters } = useFileSystemFilters();
  const { isSearching, searchInput: searchValue } = useFileSystemSearch();
  const { selectedEntry, selectedPaths } = useFileSystemSelection();
  const { draggable, onExternalDrop, onMove, testID } = useFileSystemConsumer();

  // Resolved here rather than held in the store: the selection is a set of paths,
  // and only this slot asks for it as entries.
  const selectedEntries = useMemo(
    () => [...selectedPaths].flatMap((path) => sortedIndex.files.get(path) ?? sortedIndex.folders.get(path) ?? []),
    [selectedPaths, sortedIndex],
  );

  const bodyTestID = testID ? `${testID}-body` : undefined;
  const content = <FileSystemBodyContent />;

  // Called as a plain function rather than rendered as a component, unlike the
  // header and footer slots. An inline `renderBody` arrow is a new function on
  // every render, and a component whose *type* changes remounts its whole
  // subtree — here that subtree is the active view, so every keystroke in the
  // search field would reset its scroll offset, panes and in-flight drag.
  // Calling it keeps the returned elements in the parent's own tree, where
  // reconciliation compares them by position as usual.
  const isEmpty = entries.length === 0;
  const body = renderBody
    ? renderBody({
        content,
        currentPath,
        entries,
        hasActiveFilters,
        isEmpty,
        isLoading,
        isSearching,
        searchValue,
        selectedEntries,
        selectedEntry,
        testID,
        view,
      })
    : content;

  // Names in the file area are labels, not prose, and `select-none` is on the file
  // area as a whole for two reasons. A double-click on a selectable name selects
  // the word under the cursor, and react-native-web's press responder reads that
  // `selectionchange` as a terminated gesture and drops the second press — so
  // opening a file by double-clicking its name would silently fail. And a marquee
  // pulled across the rows would drag a text selection along with it: the band
  // calls `preventDefault` on move, but only once the gesture is past its slop
  // threshold, by which point the browser has already begun selecting.
  //
  // `user-select` inherits, so this one class covers every view. Each marquee
  // surface repeats it anyway — the views are mounted directly in tests and by
  // consumers reaching for a single view, where this node isn't above them.
  //
  // The zone is this node rather than a child of it: it renders a plain `View` and
  // takes the same className, so the file area's box is unchanged and the drop
  // target is exactly the area a consumer sees.
  //
  // Uses `<FileSystemDropzone portal>` so the zone accepts every in‑library
  // file‑system drag — even one where every item already lives here. That lets
  // the origin folder "register" the drag and paint its outline, the same way
  // an expanded subfolder's scope zone does. The drop handler still runs
  // `movableFileSystemSources`, so a release that would move nothing is a
  // silent no‑op.
  return (
    <FileSystemDropzone
      className={cn('relative min-h-0 flex-1 select-none', className)}
      destination={currentPath}
      disabled={!draggable}
      onExternalDrop={onExternalDrop}
      onMove={onMove}
      portal={true}
      priority={BODY_ZONE_PRIORITY}
      testID={bodyTestID}
    >
      {({ external, isOver }: DragzoneRenderState) => (
        <>
          {body}
          <GatedBodyDropSurface external={external} isOver={isOver} />
        </>
      )}
    </FileSystemDropzone>
  );
}
