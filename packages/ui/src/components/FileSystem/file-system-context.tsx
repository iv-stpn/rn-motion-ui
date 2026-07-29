// Context that threads the full FileSystem state through the tree so that
// FileSystemHeader, FileSystemBody and the other internal regions read what
// they need directly instead of receiving everything as drilled props from
// the root.

import type { ReactNode, RefObject } from 'react';
import { createContext, useContext } from 'react';
import type { TextInput } from 'react-native';
import type {
  FileSystemBodyState,
  FileSystemContextMenuAction,
  FileSystemEmptyStateArgs,
  FileSystemEntry,
  FileSystemFileItem,
  FileSystemHeaderState,
  FileSystemItem,
  FileSystemMoveEvent,
  FileSystemStatusState,
  FileSystemViewerArgs,
} from './file-system.types';
import type { HeaderLayout } from './file-system-toolbar-parts';
import type { FileSystemOpenedFile } from './file-system-viewer-modal';
import type { FileSystemState } from './use-file-system';

/** Everything the internal regions need, pooled in one context value. */
export type FileSystemContextValue = FileSystemState & {
  // Derived entry callbacks
  openEntry: (entry: FileSystemEntry) => void;
  selectAndPrefetch: (entry: FileSystemEntry | null) => void;

  // Responsive / layout state (derived from the measured root width)
  layout: HeaderLayout;
  isCompact: boolean;
  isSearchExpanded: boolean;
  setIsSearchExpanded: (expanded: boolean) => void;
  searchInputRef: RefObject<TextInput | null>;

  // File open / viewer modal
  closeFile: () => void;
  opened: FileSystemOpenedFile | null;

  // Consumer callbacks / render props forwarded from FileSystemProps
  draggable?: boolean;
  getBackgroundContextMenuActions?: () => FileSystemContextMenuAction[];
  getContextMenuActions?: (item: FileSystemItem) => FileSystemContextMenuAction[];
  getFileUrl?: (file: FileSystemFileItem) => string | Promise<string>;
  loadPreviewImageUrl?: (file: FileSystemFileItem, pageIndex: number) => Promise<string | null>;
  onBackgroundContextMenuAction?: (action: FileSystemContextMenuAction) => void | Promise<void>;
  onContextMenuAction?: (action: FileSystemContextMenuAction, item: FileSystemItem) => void | Promise<void>;
  onMove?: (event: FileSystemMoveEvent) => void;
  renderBody?: (state: FileSystemBodyState & { testID?: string }) => ReactNode;
  renderEmptyState?: (args: FileSystemEmptyStateArgs) => ReactNode;
  renderFilePreview?: (file: FileSystemFileItem) => ReactNode;
  renderFileViewer?: (args: FileSystemViewerArgs) => ReactNode;
  /** Consumer-supplied replacement for the entire header toolbar. */
  renderHeader?: (state: FileSystemHeaderState & { testID?: string }) => ReactNode;
  /** Consumer-supplied replacement for the status bar footer. */
  renderFooter?: (state: FileSystemStatusState & { testID?: string }) => ReactNode;

  // Class names for the sub-regions
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;

  testID?: string;
};

export const FileSystemContext = createContext<FileSystemContextValue | null>(null);

export function useFileSystemContext(): FileSystemContextValue {
  const ctx = useContext(FileSystemContext);
  if (ctx === null) throw new Error('useFileSystemContext must be used within a <FileSystem>');
  return ctx;
}
