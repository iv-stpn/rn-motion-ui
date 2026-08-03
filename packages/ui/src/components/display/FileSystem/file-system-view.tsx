/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
// What every view receives, plus the empty/loading placeholder they share.

import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '../../typography/Text/text';
import { Loader } from '../Loader/loader';
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
import type { FileSystemSelectionMode, FileSystemSelectionModifiers } from './file-system-selection';

export type FileSystemViewProps = {
  currentPath: string;
  /**
   * Display name of the current folder — the `title` prop at the root. Titles
   * the background context menu's bottom sheet, and is handed to
   * `renderEmptyState` so a custom placeholder can name the folder it stands in
   * for.
   */
  folderName: string;
  /**
   * Leading breadcrumb segment — the `rootLabel` prop, falling back to `title`.
   * The search view's result rows name the folder each match came from as a
   * breadcrumb trail, and this is the segment standing for the root.
   */
  rootLabel: string;
  entries: FileSystemEntry[];
  fileFilter: ((file: FileEntry) => boolean) | null;
  index: FileSystemIndex;
  loadingFolders: Set<string>;
  onOpen: (entry: FileSystemEntry) => void;
  onSelect: (
    entry: FileSystemEntry | null,
    modifiers?: FileSystemSelectionModifiers,
    /** The pressed surface's entries in layout order — what a Shift-range runs through. */
    orderedPaths?: readonly string[],
  ) => void;
  /** One frame of a live selection box. Only the icons grid draws one — see `file-system-marquee.tsx`. */
  onMarquee: (covered: readonly string[], base: ReadonlySet<string> | null) => void;
  onSortColumnClick: (key: FileSystemSortKey) => void;
  searchQuery: string;
  /** The lead entry: what the columns preview pane and the gallery stage follow. */
  selectedEntry: FileSystemEntry | null;
  /** The lead entry's path. Views paint from `selectedPaths`, not from this. */
  selectedPath: string | null;
  /** Every selected path. Reference-stable while the selection holds, so it is safe in a memo's deps. */
  selectedPaths: ReadonlySet<string>;
  /** See `FileSystemProps.selectionMode` — `'multiple'` is what arms the long-press gesture. */
  selectionMode: FileSystemSelectionMode;
  sort: FileSystemSortState;
  /** `path#pageIndex` → thumbnail URL, shared by every pager. */
  pageUrlCache: Map<string, string>;
  /** `path` → resolved file URL, shared by the gallery stage and the viewer modal. */
  urlCache: Map<string, string>;
  loadPreviewImageUrl?: (file: FileSystemFileItem, pageIndex: number) => Promise<string | null>;
  renderEntryIcon?: (entry: FileSystemEntry, size: number) => ReactNode | null | undefined;
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
  /**
   * The root `testID`, not the view's own: each view derives one id per entry
   * from it through `entryTestID`, so the same entry answers to the same query
   * in every view. Undefined falls back to the `file-system` default.
   */
  testID?: string;
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
