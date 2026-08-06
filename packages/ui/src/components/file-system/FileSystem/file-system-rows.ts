// The list view's row model. Here the rows are flattened from the index the same way — one
// row per visible entry, folders before files at each level, recursing only
// into expanded folders — so the order matches what the other views show.

import type { FileSystemEntry, FileSystemIndex } from './file-system.types';

function isExpandableFolder(entry: FileSystemEntry, index: FileSystemIndex): boolean {
  if (entry.kind !== 'folder') return false;
  return entry.hasChildren === true || (index.children.get(entry.path)?.length ?? 0) > 0;
}

/** Row height in the list view — import this in the view instead of re-defining it. */
export const FS_ROW_HEIGHT = 30;

export type FileSystemRow = {
  entry: FileSystemEntry;
  /** Depth below the open folder, driving the row's indent. */
  level: number;
  /** Folders that can disclose children (loaded, or lazily loadable). */
  isExpandable: boolean;
  isExpanded: boolean;
};

export type FlattenRowsArgs = { currentPath: string; expanded: ReadonlySet<string>; index: FileSystemIndex };

/**
 * Rows for the open folder in display order. `index` is expected to be the
 * sorted/filtered projection, so each level's children arrive pre-ordered.
 */
export function flattenFileSystemRows({ currentPath, expanded, index }: FlattenRowsArgs): FileSystemRow[] {
  const rows: FileSystemRow[] = [];

  const walk = (folderPath: string, level: number) => {
    for (const entry of index.children.get(folderPath) ?? []) {
      const isExpandable = isExpandableFolder(entry, index);
      const isExpanded = isExpandable && expanded.has(entry.path);
      rows.push({ entry, isExpanded, isExpandable, level });
      if (isExpanded) walk(entry.path, level + 1);
    }
  };

  walk(currentPath, 0);
  return rows;
}

/** Adds or removes `path` in a copy of `expanded`, for the disclosure toggle. */
export function toggleExpandedPath(expanded: ReadonlySet<string>, path: string): Set<string> {
  const next = new Set(expanded);
  if (!next.delete(path)) next.add(path);
  return next;
}
