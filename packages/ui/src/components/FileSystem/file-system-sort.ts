// Sort options and the comparator behind every view's entry order.

import type { FileSystemEntry, FileSystemSortDirection, FileSystemSortKey, FileSystemSortState } from './file-system.types';
import { entryKindLabel } from './file-system-kinds';
import { compareEntryNames } from './file-system-paths';

export type FileSystemSortOption = {
  defaultDirection: FileSystemSortDirection;
  key: FileSystemSortKey;
  label: string;
  /** Shorter label so the toolbar trigger stays narrow. */
  triggerLabel: string;
};

export const SORT_OPTIONS: FileSystemSortOption[] = [
  { defaultDirection: 'asc', key: 'name', label: 'Name', triggerLabel: 'Name' },
  { defaultDirection: 'asc', key: 'kind', label: 'Kind', triggerLabel: 'Kind' },
  { defaultDirection: 'desc', key: 'createdAt', label: 'Date created', triggerLabel: 'Created' },
  { defaultDirection: 'desc', key: 'updatedAt', label: 'Date modified', triggerLabel: 'Modified' },
  { defaultDirection: 'desc', key: 'size', label: 'Size', triggerLabel: 'Size' },
];

export const DEFAULT_SORT: FileSystemSortState = { direction: 'asc', key: 'name' };

/** Dates and sizes start newest/largest first; names and kinds A→Z. */
export function defaultSortDirection(key: FileSystemSortKey): FileSystemSortDirection {
  return SORT_OPTIONS.find((option) => option.key === key)?.defaultDirection ?? 'asc';
}

/** Parsed epoch millis for a date column, with unparseable values sorting first. */
export function entrySortTimestamp(entry: FileSystemEntry, key: 'createdAt' | 'updatedAt'): number {
  const value = entry[key];
  const time = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(time) ? 0 : time;
}

/**
 * Primary key per the active sort; ties (and missing metadata) fall back to the
 * name order so results stay stable. The name tiebreak ignores the direction,
 * like Finder.
 */
export function compareEntriesBySort(left: FileSystemEntry, right: FileSystemEntry, sort: FileSystemSortState): number {
  let result = 0;

  if (sort.key === 'name') result = compareEntryNames(left, right);
  else if (sort.key === 'kind')
    result = entryKindLabel(left).localeCompare(entryKindLabel(right), undefined, { sensitivity: 'base' });
  else if (sort.key === 'size') {
    // Folders have no byte size; group them at the small end.
    const leftSize = left.kind === 'file' ? (left.size ?? 0) : -1;
    const rightSize = right.kind === 'file' ? (right.size ?? 0) : -1;
    result = leftSize - rightSize;
  } else result = entrySortTimestamp(left, sort.key) - entrySortTimestamp(right, sort.key);

  if (result === 0) return compareEntryNames(left, right);
  if (sort.direction === 'asc') return result < 0 ? -1 : 1;
  return result < 0 ? 1 : -1;
}
