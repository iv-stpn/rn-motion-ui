/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
// The file area: whichever view is active, or the placeholder that replaces it
// when there is nothing to show. The columns view keeps its panes even when the
// current folder is empty — that's how Finder lets you walk back up a trail —
// so it only yields to the placeholder while searching or filtering.

import type { ComponentType } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import type { FileSystemView } from './file-system.types';
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

export function FileSystemBody(props: FileSystemBodyProps) {
  return (
    <View className="min-h-0 flex-1" style={WEB_BODY_STYLE}>
      <FileSystemBodyContent {...props} />
    </View>
  );
}
