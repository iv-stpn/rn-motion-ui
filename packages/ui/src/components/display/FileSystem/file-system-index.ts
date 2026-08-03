// Builds the navigable index from a flat manifest: resolves every entry's
// identity, infers the folder prefixes files imply, groups children by parent
// and back-fills folder modified dates from their newest descendant.

import type { FileEntry, FileSystemEntry, FileSystemIndex, FileSystemItem, FolderEntry } from './file-system.types';
import { compareEntryNames, normalizeFolderPath, pathName, pathParent } from './file-system-paths';
import { isEntryPinned } from './file-system-sort';

type CollectedEntries = { files: Map<string, FileEntry>; folders: Map<string, FolderEntry> };

type PreviewImageSource = { previewImageUrl?: string | null; previewImageUrls?: string[] | null };

function collectEntries(items: FileSystemItem[]): CollectedEntries {
  const folders = new Map<string, FolderEntry>();
  const files = new Map<string, FileEntry>();

  // Walk up from a prefix, materializing every missing ancestor. Stops at the
  // first folder already present — its own chain was created with it.
  const ensureFolderChain = (folderPath: string) => {
    let path = normalizeFolderPath(folderPath);
    while (path && !folders.has(path)) {
      folders.set(path, { kind: 'folder', name: pathName(path), parentPath: pathParent(path), path });
      path = pathParent(path);
    }
  };

  // A folder normalizing to `''` is the root, and a file with no path has no
  // identity — both are dropped rather than indexed.
  for (const item of items) {
    if (item.kind === 'folder') {
      const path = normalizeFolderPath(item.path);
      if (path) {
        folders.set(path, {
          ...item,
          name: item.name ?? pathName(path),
          parentPath: normalizeFolderPath(item.parentPath ?? pathParent(path)),
          path,
        });
        ensureFolderChain(pathParent(path));
      }
    } else if (item.path) {
      files.set(item.path, {
        ...item,
        key: item.key ?? item.path,
        name: item.name ?? pathName(item.path),
        parentPath: normalizeFolderPath(item.parentPath ?? pathParent(item.path)),
      });
      ensureFolderChain(pathParent(item.path));
    }
  }

  return { files, folders };
}

/**
 * Folders without an explicit modified date inherit their newest child's —
 * object stores carry no folder metadata, yet the list view shows the column
 * and the date sorts compare it. Deepest first (a descendant's path is always
 * longer than its ancestor's) so dates propagate up the whole chain.
 */
function newestChildDate(siblings: FileSystemEntry[]): string | undefined {
  let newestTime = Number.NEGATIVE_INFINITY;
  let newestValue: string | undefined;

  for (const child of siblings) {
    const value = child.updatedAt ?? child.createdAt;
    const time = value ? Date.parse(value) : Number.NaN;
    if (!Number.isNaN(time) && time > newestTime) {
      newestTime = time;
      newestValue = value;
    }
  }
  return newestValue;
}

function inheritFolderTimestamps(folders: Map<string, FolderEntry>, children: Map<string, FileSystemEntry[]>): void {
  const foldersDeepestFirst = [...folders.values()].sort((left, right) => right.path.length - left.path.length);

  for (const folder of foldersDeepestFirst) {
    if (!folder.updatedAt) {
      const inherited = newestChildDate(children.get(folder.path) ?? []);
      if (inherited) folder.updatedAt = inherited;
    }
  }
}

/** Index a manifest. Children are name-sorted; views re-sort per the active sort. */
export function buildFileSystemIndex(items: FileSystemItem[]): FileSystemIndex {
  const { files, folders } = collectEntries(items);

  const children = new Map<string, FileSystemEntry[]>();
  const pushChild = (entry: FileSystemEntry) => {
    const siblings = children.get(entry.parentPath);
    if (siblings) siblings.push(entry);
    else children.set(entry.parentPath, [entry]);
  };

  for (const folder of folders.values()) pushChild(folder);
  for (const file of files.values()) pushChild(file);
  for (const siblings of children.values())
    siblings.sort((left, right) => {
      const leftPinned = isEntryPinned(left);
      const rightPinned = isEntryPinned(right);
      if (leftPinned !== rightPinned) return leftPinned ? -1 : 1;
      return compareEntryNames(left, right);
    });

  inheritFolderTimestamps(folders, children);

  return { children, files, folders };
}

/** True when a folder has loaded children or advertises unloaded ones. */
export function folderHasChildren(index: FileSystemIndex, folder: FolderEntry): boolean {
  return (index.children.get(folder.path)?.length ?? 0) > 0 || folder.hasChildren === true;
}

/** Page URLs for a file's thumbnail pager (cover first). */
export function filePreviewUrls(file: PreviewImageSource): string[] {
  if (file.previewImageUrls?.length) return file.previewImageUrls;
  return file.previewImageUrl ? [file.previewImageUrl] : [];
}
