/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
// The file area: whichever view is active, or the placeholder that replaces it
// when there is nothing to show. The columns view keeps its panes even when the
// current folder is empty — that's how Finder lets you walk back up a trail —
// so it only yields to the placeholder while searching or filtering.
//
// `renderBody` wraps that default content rather than replacing it: the slot
// receives the node and returns a tree containing it, so a consumer can add a
// sidebar or an overlay without reimplementing the four views.

import type { ComponentType, ReactNode } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import { cn } from '../../lib/cn';
import type { FileSystemBodyState, FileSystemView } from './file-system.types';
import { FileSystemColumnsView } from './file-system-columns-view';
import { FileSystemGalleryView } from './file-system-gallery-view';
import { FileSystemIconsView } from './file-system-icons-view';
import { FileSystemListView } from './file-system-list-view';
import type { FileSystemViewProps } from './file-system-view';
import { FileSystemEmptyState } from './file-system-view';

const LOADING_LABEL = 'Loading…';
const EMPTY_FOLDER_LABEL = 'This folder is empty';
const NO_FILTER_MATCH_LABEL = 'No items match the active filters';

const VIEW_COMPONENTS: Record<FileSystemView, ComponentType<FileSystemViewProps>> = {
  columns: FileSystemColumnsView,
  gallery: FileSystemGalleryView,
  icons: FileSystemIconsView,
  list: FileSystemListView,
};

export type FileSystemBodyProps = FileSystemViewProps & {
  hasActiveFilters: boolean;
  isLoadingCurrentFolder: boolean;
  isSearching: boolean;
  /** Raw input rather than the normalized query, so the message quotes what was typed. */
  searchInput: string;
  view: FileSystemView;
  /** Extra NativeWind classes merged onto the file-area root view. */
  className?: string;
  /** See `FileSystemProps.renderBody`. */
  renderBody?: (state: FileSystemBodyState & { testID?: string }) => ReactNode;
};

type EmptyLabelArgs = Pick<FileSystemBodyProps, 'hasActiveFilters' | 'isSearching' | 'searchInput'>;

function emptyLabel({ hasActiveFilters, isSearching, searchInput }: EmptyLabelArgs): string {
  if (isSearching) return `No results for “${searchInput.trim()}”`;
  return hasActiveFilters ? NO_FILTER_MATCH_LABEL : EMPTY_FOLDER_LABEL;
}

/** Placeholder or view, whichever the current state calls for. */
function FileSystemBodyContent({
  hasActiveFilters,
  isLoadingCurrentFolder,
  isSearching,
  searchInput,
  view,
  ...viewProps
}: FileSystemBodyProps) {
  const isEmpty = viewProps.entries.length === 0;
  if (isLoadingCurrentFolder && isEmpty) return <FileSystemEmptyState isLoading={true} label={LOADING_LABEL} />;

  if (isEmpty && (view !== 'columns' || isSearching || hasActiveFilters))
    return <FileSystemEmptyState label={emptyLabel({ hasActiveFilters, isSearching, searchInput })} />;

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
export function FileSystemBody({ className, renderBody, ...props }: FileSystemBodyProps) {
  const bodyTestID = props.testID ? `${props.testID}-body` : undefined;
  const content = <FileSystemBodyContent {...props} />;

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
        currentPath: props.currentPath,
        entries: props.entries,
        hasActiveFilters: props.hasActiveFilters,
        isEmpty: props.entries.length === 0,
        isLoadingCurrentFolder: props.isLoadingCurrentFolder,
        isSearching: props.isSearching,
        searchValue: props.searchInput,
        selectedEntry: props.selectedEntry,
        testID: props.testID,
        view: props.view,
      })
    : content;

  return (
    <View className={cn('min-h-0 flex-1', className)} style={WEB_BODY_STYLE} testID={bodyTestID}>
      {body}
    </View>
  );
}
