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

/**
 * Whether a folder that lost all its children was moved wholesale rather than
 * emptied in place. A move leaves the source name behind under its new parent —
 * the dragged folder lands at `<destination>/<name>/` — so the husk at `path` is
 * the one that reappears elsewhere with the same name and the same children.
 *
 * Comparing children, not just the name, keeps a genuinely separate folder that
 * happens to share a name with an emptied one from being mistaken for the mover.
 */
function folderMovedAway(
  path: string,
  children: Map<string, FileSystemEntry[]>,
  previousChildren: Map<string, FileSystemEntry[]> | undefined,
): boolean {
  const previous = previousChildren?.get(path);
  if (!previous || previous.length === 0) return false;
  const previousNames = new Set(previous.map((child) => child.name));
  const name = pathName(path);

  for (const candidate of children.keys()) {
    if (candidate !== path && pathName(candidate) === name) {
      const moved = children.get(candidate) ?? [];
      if (moved.length === previous.length && moved.every((child) => previousNames.has(child.name))) return true;
    }
  }
  return false;
}

/** Index a manifest. Children are name-sorted; views re-sort per the active sort. */
type BuildFileSystemIndexOptions = {
  preserveFolders?: Map<string, FolderEntry>;
  /** The previous index's child map, used to tell a moved folder from an emptied one. */
  previousChildren?: Map<string, FileSystemEntry[]>;
  /**
   * Folder paths the previous manifest declared with `{ kind: 'folder' }`. An
   * absent declared folder was deleted by the consumer, not emptied by a move,
   * so it must not be resurrected as a preserved husk.
   */
  declaredFolders?: ReadonlySet<string>;
};
export function buildFileSystemIndex(items: FileSystemItem[], options?: BuildFileSystemIndexOptions): FileSystemIndex {
  const { files, folders } = collectEntries(items);

  const children = new Map<string, FileSystemEntry[]>();
  const pushChild = (entry: FileSystemEntry) => {
    const siblings = children.get(entry.parentPath);
    if (siblings) siblings.push(entry);
    else children.set(entry.parentPath, [entry]);
  };

  for (const folder of folders.values()) pushChild(folder);
  for (const file of files.values()) pushChild(file);

  // Preserve folders from the previous index that lost all their children
  // (e.g. every file was dragged out). Without this an inferred folder — one
  // the consumer never listed as `{ kind: 'folder', path: '...' }` — vanishes
  // from the tree the moment its last child leaves, which is not how a file
  // browser works: an empty folder is still a folder.
  //
  // A folder whose whole subtree was *moved* is the one exception: it has no
  // children here for the same reason, but it must not linger as an empty husk
  // where it used to be. A folder the previous manifest declared explicitly is
  // the other: when it is gone from the new items it was deleted, so nothing
  // should keep it in the tree.
  if (options?.preserveFolders) {
    for (const [path, folder] of options.preserveFolders) {
      const dropped =
        options.declaredFolders?.has(path) === true ||
        folders.has(path) ||
        folderMovedAway(path, children, options.previousChildren);
      if (!dropped) {
        folders.set(path, { ...folder });
        pushChild(folder);
      }
    }
  }

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
