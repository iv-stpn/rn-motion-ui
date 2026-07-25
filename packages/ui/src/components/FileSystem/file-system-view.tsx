/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
// What every view receives, plus the empty/loading placeholder they share.

import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Loader } from '../Loader/loader';
import { Text } from '../Text/text';
import type {
  FileEntry,
  FileSystemContextMenuAction,
  FileSystemEntry,
  FileSystemFileItem,
  FileSystemIndex,
  FileSystemItem,
  FileSystemMoveEvent,
  FileSystemSortKey,
  FileSystemSortState,
  FileSystemViewerArgs,
} from './file-system.types';

export type FileSystemViewProps = {
  currentPath: string;
  entries: FileSystemEntry[];
  fileFilter: ((file: FileEntry) => boolean) | null;
  index: FileSystemIndex;
  loadingFolders: Set<string>;
  onOpen: (entry: FileSystemEntry) => void;
  onSelect: (entry: FileSystemEntry | null) => void;
  onSortColumnClick: (key: FileSystemSortKey) => void;
  searchQuery: string;
  selectedEntry: FileSystemEntry | null;
  selectedPath: string | null;
  sort: FileSystemSortState;
  /** `path#pageIndex` → thumbnail URL, shared by every pager. */
  pageUrlCache: Map<string, string>;
  /** `path` → resolved file URL, shared by the gallery stage and the viewer modal. */
  urlCache: Map<string, string>;
  loadPreviewImageUrl?: (file: FileSystemFileItem, pageIndex: number) => Promise<string | null>;
  renderFilePreview?: (file: FileSystemFileItem) => ReactNode;
  getFileUrl?: (file: FileSystemFileItem) => string | Promise<string>;
  renderFileViewer?: (args: FileSystemViewerArgs) => ReactNode;
  /** See `FileSystemProps.getContextMenuActions`. */
  getContextMenuActions?: (item: FileSystemItem) => FileSystemContextMenuAction[];
  /** See `FileSystemProps.onContextMenuAction`. */
  onContextMenuAction?: (action: FileSystemContextMenuAction, item: FileSystemItem) => void | Promise<void>;
  /** See `FileSystemProps.getBackgroundContextMenuActions`. */
  getBackgroundContextMenuActions?: () => FileSystemContextMenuAction[];
  /** See `FileSystemProps.onBackgroundContextMenuAction`. */
  onBackgroundContextMenuAction?: (action: FileSystemContextMenuAction) => void | Promise<void>;
  /** See `FileSystemProps.draggable`. */
  draggable?: boolean;
  /** See `FileSystemProps.onMove`. */
  onMove?: (event: FileSystemMoveEvent) => void;
};

export type FileSystemEmptyStateProps = { isLoading?: boolean; label: string };

/** Fills the file area when there is nothing to show, or nothing yet. */
export function FileSystemEmptyState({ isLoading = false, label }: FileSystemEmptyStateProps) {
  return (
    <View className="size-full flex-1 items-center justify-center gap-2">
      {isLoading ? <Loader size={20} variant="spinner" /> : null}
      <Text className="text-muted-foreground" size="sm">
        {label}
      </Text>
    </View>
  );
}
