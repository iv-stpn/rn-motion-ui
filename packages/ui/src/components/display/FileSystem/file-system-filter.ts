// Filter model: a list of {type, operator, value[]} rows ANDed together. Date
// filters hold either one relative preset ("1 week ago") or two ISO timestamps
// (a custom range); file-type filters hold a set of MIME types.

import type {
  FileEntry,
  FileSystemFilter,
  FileSystemFilterOperator,
  FileSystemFilterType,
  FileTypeFilterGroup,
} from './file-system.types';
import { mimeTypeForFile } from './file-system-kinds';

export const FILE_TYPE_FILTER_GROUPS: FileTypeFilterGroup[] = [
  'Documents',
  'Spreadsheets',
  'Images',
  'Code',
  'Text',
  'Archives & binary',
];

export const FILTER_TYPE_LABELS: Record<FileSystemFilterType, string> = {
  dateCreated: 'Date created',
  dateModified: 'Date modified',
  fileType: 'File type',
};

export const FILTER_OPERATOR_LABELS: Record<FileSystemFilterOperator, string> = {
  after: 'after',
  before: 'before',
  'in-range': 'in range',
  is: 'is',
  'is-any-of': 'is any of',
  'is-not': 'is not',
  'not-in-range': 'not in range',
};

/** Relative cutoffs offered by the filter menu's date submenus. */
export const DATE_FILTER_PRESETS = [
  '1 day ago',
  '3 days ago',
  '1 week ago',
  '1 month ago',
  '3 months ago',
  '6 months ago',
  '1 year ago',
];

/**
 * Resolve a preset (or a raw parseable date string) to its cutoff instant.
 * Evaluated at filter time, so "1 week ago" keeps sliding with the clock.
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

/** Custom ranges store two parseable timestamps instead of a relative preset. */
export function isCustomDateRangeValue(value: string[]): value is [string, string] {
  return value.length === 2 && value.every((entry) => !(DATE_FILTER_PRESETS.includes(entry) || Number.isNaN(Date.parse(entry))));
}

/** Operators a pill may switch between, given what its value holds. */
export function filterOperatorChoices(filter: FileSystemFilter): FileSystemFilterOperator[] {
  if (filter.type === 'fileType') return filter.value.length > 1 ? ['is-any-of', 'is-not'] : ['is', 'is-not'];
  if (isCustomDateRangeValue(filter.value)) return ['in-range', 'not-in-range'];
  return ['before', 'after'];
}

/** An empty value list matches everything, so a half-built pill hides nothing. */
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

/**
 * Normalized query for path matching: trimmed, backslashes folded to slashes,
 * lowercased. Empty when the query is blank (no filtering).
 */
export function normalizeSearchQuery(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.replaceAll('\\', '/').toLowerCase();
}
