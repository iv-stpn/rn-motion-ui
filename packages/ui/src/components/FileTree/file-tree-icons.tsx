// Render layer for file-type icons: maps the RN-free FileTreeIconName (from
// file-tree-icon.ts) to a concrete lib/icons component. Folders always draw
// FolderClosed — there is no FolderOpen in the generated icon set, and the
// row's chevron rotation already signals expand/collapse state.

import type { ComponentType } from 'react';
import {
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileIcon as FileUnknown,
  FileVideo,
  FolderClosed,
  type IconProps,
} from '../../lib/icons';
import type { FileTreeIconName } from './file-tree-icon';

/** The concrete icon component for each FileTreeIconName. */
const ICONS: Record<FileTreeIconName, ComponentType<IconProps>> = {
  FolderClosed,
  FileCode2,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileSpreadsheet,
  FileText,
  FileIcon: FileUnknown,
};

export type FileTreeIconProps = IconProps & {
  /** The resolved icon name (from resolveFileTreeIcon). */
  name: FileTreeIconName;
};

/** Draw the icon for a resolved FileTreeIconName. */
export function FileTreeIcon({ name, ...props }: FileTreeIconProps) {
  const Icon = ICONS[name];
  return <Icon {...props} />;
}
