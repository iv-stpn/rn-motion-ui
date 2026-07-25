// Search/filter visibility and per-sort child ordering. Pure so the whole
// query→visible-rows pipeline is unit-testable without the render layer.

import type { FileEntry, FileSystemEntry, FileSystemIndex, FileSystemSortState } from './file-system.types';
import { pathParent } from './file-system-paths';
import { compareEntriesBySort, DEFAULT_SORT } from './file-system-sort';

export type VisibilityArgs = {
  currentPath: string;
  index: FileSystemIndex;
  /** Normalized query (see `normalizeSearchQuery`); `''` disables name matching. */
  searchQuery: string;
  fileFilter: ((file: FileEntry) => boolean) | null;
};

/**
 * Paths that stay visible while searching or filtering: every file under
 * `currentPath` whose relative path contains the query and passes the filters,
 * plus the ancestor folders leading to it. Folder names participate in search
 * matches only when no filters are active — with filters, a folder is only as
 * visible as the files inside it.
 *
 * Returns `null` when nothing is filtered, so callers can reuse the index as-is.
 */
export function computeVisiblePaths({ currentPath, fileFilter, index, searchQuery }: VisibilityArgs): Set<string> | null {
  const isSearching = searchQuery.length > 0;
  if (!(isSearching || fileFilter)) return null;

  const visible = new Set<string>();
  // Walk up to (but not including) the current folder, stopping early once a
  // branch is already marked.
  const markVisible = (path: string) => {
    let cursor = path;
    while (cursor && cursor !== currentPath && !visible.has(cursor)) {
      visible.add(cursor);
      cursor = pathParent(cursor);
    }
  };
  const matchesQuery = (path: string) => !isSearching || path.slice(currentPath.length).toLowerCase().includes(searchQuery);
  const isUnderCurrent = (path: string) => path !== currentPath && (!currentPath || path.startsWith(currentPath));

  for (const [path, file] of index.files) {
    if (isUnderCurrent(path) && matchesQuery(path) && (!fileFilter || fileFilter(file))) markVisible(path);
  }
  if (!fileFilter) {
    for (const path of index.folders.keys()) {
      if (isUnderCurrent(path) && matchesQuery(path)) markVisible(path);
    }
  }
  return visible;
}

/** Restrict an index's children to `visiblePaths` (identity when `null`). */
export function filterIndexToVisible(index: FileSystemIndex, visiblePaths: Set<string> | null): FileSystemIndex {
  if (!visiblePaths) return index;

  const children = new Map<string, FileSystemEntry[]>();
  for (const [parent, parentChildren] of index.children) {
    const visibleChildren = parentChildren.filter((entry) => visiblePaths.has(entry.path));
    if (visibleChildren.length) children.set(parent, visibleChildren);
  }
  return { ...index, children };
}

/**
 * Children re-sorted per the active sort. The default (name ascending) reuses
 * the index's pre-sorted arrays untouched.
 */
export function sortIndexChildren(index: FileSystemIndex, sort: FileSystemSortState): FileSystemIndex {
  if (sort.key === DEFAULT_SORT.key && sort.direction === DEFAULT_SORT.direction) return index;

  const children = new Map<string, FileSystemEntry[]>();
  for (const [parent, parentChildren] of index.children)
    children.set(
      parent,
      [...parentChildren].sort((left, right) => compareEntriesBySort(left, right, sort)),
    );
  return { ...index, children };
}
