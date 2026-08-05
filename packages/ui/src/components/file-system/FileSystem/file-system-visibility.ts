// Search/filter visibility, the filter model's matcher, and per-sort child
// ordering. Pure so the whole query→visible-rows pipeline is unit-testable
// without the render layer.

import type { FileEntry, FileSystemEntry, FileSystemFilter, FileSystemIndex, FileSystemSortState } from './file-system.types';
import { mimeTypeForFile } from './file-system-kinds';
import { pathParent } from './file-system-paths';
import { compareEntriesBySort, DEFAULT_SORT } from './file-system-sort';

type NamedEntry = { name: string };
type AncestorEntry = { path: string; parentPath: string };

export type VisibilityArgs = {
  currentPath: string;
  index: FileSystemIndex;
  /** Trimmed, slash-folded, lowercased query; `''` disables name matching. */
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
  // branch is already marked. Uses `parentPath` from the index rather than
  // path-string slicing so flat id-based manifests are handled correctly.
  const getParentPath = (path: string): string => {
    const entry = index.folders.get(path) ?? index.files.get(path);
    return entry?.parentPath ?? pathParent(path);
  };
  const markVisible = (path: string) => {
    let cursor = path;
    while (cursor && cursor !== currentPath && !visible.has(cursor)) {
      visible.add(cursor);
      cursor = getParentPath(cursor);
    }
  };

  // Match against the entry's display name, not its path. Id-based paths don't
  // embed the name, so path-substring matching eliminates every result.
  const matchesQuery = (entry: NamedEntry): boolean => !isSearching || entry.name.toLowerCase().includes(searchQuery);

  // An entry is "under current" when its parentPath ancestry chain passes
  // through currentPath. path.startsWith(currentPath) only works when paths
  // encode depth; flat parentPath manifests need the chain walk instead.
  const isUnderCurrent = (entry: AncestorEntry): boolean => {
    if (entry.path === currentPath) return false;
    if (!currentPath) return true;
    // Fast path: hierarchical paths encode ancestry in the string itself.
    // Avoids O(depth) chain walks for the common case.
    if (entry.parentPath === currentPath || entry.parentPath.startsWith(`${currentPath}/`)) return true;
    // Fallback for flat / id-based manifests where paths don't encode depth.
    let cursor: string = entry.parentPath;
    while (cursor) {
      if (cursor === currentPath) return true;
      const folder = index.folders.get(cursor);
      if (!folder) return false;
      cursor = folder.parentPath;
    }
    return false;
  };

  for (const file of index.files.values()) {
    if (isUnderCurrent(file) && matchesQuery(file) && (!fileFilter || fileFilter(file))) markVisible(file.path);
  }
  if (!fileFilter) {
    for (const folder of index.folders.values()) {
      if (isUnderCurrent(folder) && matchesQuery(folder)) markVisible(folder.path);
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

// ── Filter model ──────────────────────────────────────────────────────────────
// A filter list is {type, operator, value[]} rows ANDed together into the
// `fileFilter` predicate above. Date filters hold either one relative preset
// ("1 week ago") or two ISO timestamps (a custom range); file-type filters hold
// a set of MIME types.

/**
 * Resolve a relative preset to its cutoff instant. Anything else parseable is
 * read as an absolute date, so a custom range's ISO timestamps come through
 * here too. Evaluated at filter time, so "1 week ago" keeps sliding with the
 * clock rather than freezing at the moment the filter was added.
 *
 * The presets, which is also the vocabulary `selectDatePreset` accepts:
 * `1 day ago`, `3 days ago`, `1 week ago`, `1 month ago`, `3 months ago`,
 * `6 months ago`, `1 year ago`.
 */
export function dateFilterPresetCutoff(preset: string, now: Date = new Date()): Date {
  const date = new Date(now.getTime());

  switch (preset) {
    case '1 day ago':
      date.setDate(date.getDate() - 1);
      break;
    case '3 days ago':
      date.setDate(date.getDate() - 3);
      break;
    case '1 week ago':
      date.setDate(date.getDate() - 7);
      break;
    case '1 month ago':
      date.setMonth(date.getMonth() - 1);
      break;
    case '3 months ago':
      date.setMonth(date.getMonth() - 3);
      break;
    case '6 months ago':
      date.setMonth(date.getMonth() - 6);
      break;
    case '1 year ago':
      date.setFullYear(date.getFullYear() - 1);
      break;
    default: {
      const parsed = Date.parse(preset);
      if (!Number.isNaN(parsed)) return new Date(parsed);
    }
  }
  return date;
}

/** An empty value list matches everything, so a half-built filter hides nothing. */
export function fileMatchesFilter(file: FileEntry, filter: FileSystemFilter): boolean {
  const [firstValue, secondValue] = filter.value;
  if (firstValue === undefined) return true;

  if (filter.type === 'fileType') {
    const matches = filter.value.includes(mimeTypeForFile(file));
    return filter.operator === 'is-not' ? !matches : matches;
  }

  const timestamp = filter.type === 'dateCreated' ? file.createdAt : file.updatedAt;
  const time = timestamp ? Date.parse(timestamp) : Number.NaN;
  if (Number.isNaN(time)) return false;

  if (filter.operator === 'in-range' || filter.operator === 'not-in-range') {
    const from = Date.parse(firstValue);
    const to = Date.parse(secondValue ?? firstValue);
    const isInRange = time >= from && time <= to;
    return filter.operator === 'not-in-range' ? !isInRange : isInRange;
  }

  const cutoff = dateFilterPresetCutoff(firstValue).getTime();
  return filter.operator === 'before' ? time <= cutoff : time >= cutoff;
}
