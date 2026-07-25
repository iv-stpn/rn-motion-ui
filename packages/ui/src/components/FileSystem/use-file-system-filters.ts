/** biome-ignore-all lint/style/useExportsLast: hook + its state/param types read best together */
// The filter slice of <FileSystem>'s state: the pill list, its mutators, and
// the derived predicate every view filters files through.

import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  FileEntry,
  FileSystemDateFilterType,
  FileSystemFilter,
  FileSystemFilterOperator,
  FileSystemIndex,
  FileTypeFilterOption,
} from './file-system.types';
import type { DateRange } from './file-system-calendar';
import { fileMatchesFilter, isCustomDateRangeValue } from './file-system-filter';
import { fileTypeFilterGroup, MIME_TYPE_LABELS, mimeTypeForFile } from './file-system-kinds';

/** A pending "Custom date range…" request, i.e. the modal's open state. */
export type DateRangeRequest = { initialRange?: DateRange; type: FileSystemDateFilterType };

export type FileSystemFiltersState = {
  filters: FileSystemFilter[];
  hasActiveFilters: boolean;
  /** `null` when nothing is filtered, so views can skip the pass entirely. */
  fileFilter: ((file: FileEntry) => boolean) | null;
  fileTypeOptions: FileTypeFilterOption[];
  dateRangeRequest: DateRangeRequest | null;
  clearFilters: () => void;
  removeFilter: (id: string) => void;
  setFilterOperator: (id: string, operator: FileSystemFilterOperator) => void;
  setFilterDatePreset: (id: string, preset: string) => void;
  toggleFileTypeFilterValue: (mime: string, checked: boolean) => void;
  setDatePresetFilter: (type: FileSystemDateFilterType, preset: string) => void;
  openDateRangeRequest: (type: FileSystemDateFilterType) => void;
  closeDateRangeRequest: () => void;
  applyCustomDateRange: (type: FileSystemDateFilterType, from: Date, to: Date) => void;
};

/**
 * Distinct MIME types across the loaded manifest, labeled for the filter menu;
 * the first file seen per type lends its name to the option icon.
 */
function useFileTypeOptions(index: FileSystemIndex): FileTypeFilterOption[] {
  return useMemo(() => {
    const byMime = new Map<string, FileTypeFilterOption>();

    // First file per MIME wins — later ones would only re-derive the same option.
    for (const file of index.files.values()) {
      const mime = mimeTypeForFile(file);
      if (!byMime.has(mime)) {
        // The leading-dot check keeps dotfiles (.gitignore) whole.
        const dotIndex = file.name.lastIndexOf('.');
        const extension = dotIndex > 0 ? file.name.slice(dotIndex + 1).toLowerCase() : '';

        byMime.set(mime, {
          group: fileTypeFilterGroup(mime),
          // A synthesized generic name, so files with branded icons don't lend
          // them to the whole type; extensionless names keep their own icon.
          iconFileName: extension ? `file.${extension}` : file.name,
          label: MIME_TYPE_LABELS[mime] ?? mime,
          mime,
        });
      }
    }
    return [...byMime.values()].sort((left, right) => left.label.localeCompare(right.label));
  }, [index]);
}

/** Add/remove a MIME from the single file-type pill, retiring it when empty. */
function nextFileTypeFilters(previous: FileSystemFilter[], id: string, mime: string, checked: boolean): FileSystemFilter[] {
  const existing = previous.find((filter) => filter.type === 'fileType');

  if (!existing) {
    if (!checked) return previous;
    return [...previous, { id, operator: 'is', type: 'fileType', value: [mime] }];
  }

  const value = checked ? [...new Set([...existing.value, mime])] : existing.value.filter((entry) => entry !== mime);
  if (value.length === 0) return previous.filter((filter) => filter !== existing);

  // "is" and "is any of" track the value count; "is not" is unaffected.
  const tracksCount = existing.operator === 'is' || existing.operator === 'is-any-of';
  const countOperator: FileSystemFilterOperator = value.length > 1 ? 'is-any-of' : 'is';
  const operator = tracksCount ? countOperator : existing.operator;

  return previous.map((filter) => (filter === existing ? { ...filter, operator, value } : filter));
}

export function useFileSystemFilters(index: FileSystemIndex): FileSystemFiltersState {
  const [filters, setFilters] = useState<FileSystemFilter[]>([]);
  const filterIdRef = useRef(0);
  const [dateRangeRequest, setDateRangeRequest] = useState<DateRangeRequest | null>(null);
  const fileTypeOptions = useFileTypeOptions(index);

  const nextFilterId = useCallback(() => {
    filterIdRef.current += 1;
    return `filter-${filterIdRef.current}`;
  }, []);

  // Files must pass every active filter; folders stay visible through matching
  // descendants, so the predicate only ever sees files.
  const fileFilter = useMemo(() => {
    if (filters.length === 0) return null;
    return (file: FileEntry) => filters.every((filter) => fileMatchesFilter(file, filter));
  }, [filters]);

  const toggleFileTypeFilterValue = useCallback(
    (mime: string, checked: boolean) => {
      const id = nextFilterId();
      setFilters((previous) => nextFileTypeFilters(previous, id, mime, checked));
    },
    [nextFilterId],
  );

  const setDatePresetFilter = useCallback(
    (type: FileSystemDateFilterType, preset: string) => {
      const id = nextFilterId();
      setFilters((previous) => [
        ...previous.filter((filter) => filter.type !== type),
        { id, operator: 'after', type, value: [preset] },
      ]);
    },
    [nextFilterId],
  );

  // Editing an existing custom range seeds the modal with its bounds.
  const openDateRangeRequest = useCallback(
    (type: FileSystemDateFilterType) => {
      const existing = filters.find((filter) => filter.type === type);
      const bounds = existing && isCustomDateRangeValue(existing.value) ? existing.value : null;
      setDateRangeRequest({
        initialRange: bounds ? { from: new Date(bounds[0]), to: new Date(bounds[1]) } : undefined,
        type,
      });
    },
    [filters],
  );

  const applyCustomDateRange = useCallback(
    (type: FileSystemDateFilterType, from: Date, to: Date) => {
      const id = nextFilterId();
      setFilters((previous) => {
        const existing = previous.find((filter) => filter.type === type);
        const operator: FileSystemFilterOperator = existing?.operator === 'not-in-range' ? 'not-in-range' : 'in-range';
        return [
          ...previous.filter((filter) => filter.type !== type),
          { id, operator, type, value: [from.toISOString(), to.toISOString()] },
        ];
      });
    },
    [nextFilterId],
  );

  const setFilterOperator = useCallback((id: string, operator: FileSystemFilterOperator) => {
    setFilters((previous) => previous.map((entry) => (entry.id === id ? { ...entry, operator } : entry)));
  }, []);

  // Switching a range pill back to a relative preset also switches the
  // operator out of the range pair (unless it already is before/after).
  const setFilterDatePreset = useCallback((id: string, preset: string) => {
    setFilters((previous) =>
      previous.map((entry) => {
        if (entry.id !== id) return entry;
        const keepsOperator = entry.operator === 'before' || entry.operator === 'after';
        return { ...entry, operator: keepsOperator ? entry.operator : 'after', value: [preset] };
      }),
    );
  }, []);

  const removeFilter = useCallback((id: string) => {
    setFilters((previous) => previous.filter((entry) => entry.id !== id));
  }, []);

  const clearFilters = useCallback(() => setFilters([]), []);
  const closeDateRangeRequest = useCallback(() => setDateRangeRequest(null), []);

  return {
    applyCustomDateRange,
    clearFilters,
    closeDateRangeRequest,
    dateRangeRequest,
    fileFilter,
    fileTypeOptions,
    filters,
    hasActiveFilters: filters.length > 0,
    openDateRangeRequest,
    removeFilter,
    setDatePresetFilter,
    setFilterDatePreset,
    setFilterOperator,
    toggleFileTypeFilterValue,
  };
}
