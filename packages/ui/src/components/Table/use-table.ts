import { useCallback, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent, View } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import type { RowEntry, SortState, TableProps } from './table-types';
import { computeColumnWidths, nextSort, sortRows } from './table-utils';
import { useColumnReorder } from './use-column-reorder';

// Returns all state, derived values, and stable callbacks for <Table>.
// Kept JSX-free so it can live in a .ts file.
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: all table state (sort, filter, select, edit, delete) lives in one hook to share derived values
export function useTable<T>(props: TableProps<T>) {
  const {
    data,
    columns,
    getRowId,
    selectable = false,
    selectedRowIds,
    defaultSelectedRowIds,
    onSelectionChange,
    sort: sortProp,
    defaultSort = null,
    onSortChange,
    onColumnOrderChange,
    onCellEdit,
    onInsertRow,
    onDeleteRow,
    onInsertColumn,
    onDeleteColumn,
    rowHeight = 48,
    height = 440,
    onEndReached,
    onEndReachedThreshold = 0.2,
    loading = false,
    skeletonRows = 3,
    emptyState = 'No data',
    testID,
  } = props;

  const reduce = useReducedMotion();

  // ── Container width + page-x ───────────────────────────────────────────────
  const containerRef = useRef<View | null>(null);
  const containerPageX = useRef(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
    containerRef.current?.measureInWindow?.((x) => {
      containerPageX.current = x;
    });
  }, []);

  const colWidths = useMemo(
    () => (containerWidth > 0 ? computeColumnWidths(columns, containerWidth, selectable) : {}),
    [columns, containerWidth, selectable],
  );

  // ── Column reorder ─────────────────────────────────────────────────────────
  const { orderedColumns, boundaries, dragKey, dropIndex, gripHandlers } = useColumnReorder({
    columns,
    colWidths,
    selectable,
    containerRef,
    containerPageX,
    onColumnOrderChange,
  });

  // ── Row entries ────────────────────────────────────────────────────────────
  const rows: RowEntry<T>[] = useMemo(
    () => data.map((row, index) => ({ row, id: getRowId ? getRowId(row, index) : String(index) })),
    [data, getRowId],
  );

  // ── Sort state (controllable) ──────────────────────────────────────────────
  const isControlledSort = sortProp !== undefined;
  const [internalSort, setInternalSort] = useState<SortState | null>(defaultSort ?? null);
  const activeSort = isControlledSort ? (sortProp ?? null) : internalSort;

  const toggleSort = useCallback(
    (key: string) => {
      const next = nextSort(activeSort, key);
      if (!isControlledSort) setInternalSort(next);
      onSortChange?.(next);
    },
    [activeSort, isControlledSort, onSortChange],
  );

  const sortedRows = useMemo(() => sortRows(rows, activeSort), [rows, activeSort]);

  // ── Selection state (controllable) ────────────────────────────────────────
  const isControlledSelection = selectedRowIds !== undefined;
  const [internalSelected, setInternalSelected] = useState<Set<string>>(() => new Set(defaultSelectedRowIds ?? []));
  const selected: Set<string> = isControlledSelection ? new Set(selectedRowIds) : internalSelected;

  const allSelected = sortedRows.length > 0 && sortedRows.every(({ id }) => selected.has(id));
  const someSelected = !allSelected && sortedRows.some(({ id }) => selected.has(id));

  const toggleAll = useCallback(() => {
    const next = allSelected ? new Set<string>() : new Set(sortedRows.map(({ id }) => id));
    if (!isControlledSelection) setInternalSelected(next);
    onSelectionChange?.(Array.from(next));
  }, [allSelected, sortedRows, isControlledSelection, onSelectionChange]);

  const toggleRow = useCallback(
    (id: string) => {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (!isControlledSelection) setInternalSelected(next);
      onSelectionChange?.(Array.from(next));
    },
    [selected, isControlledSelection, onSelectionChange],
  );

  // ── Row / col action menus ─────────────────────────────────────────────────
  const [pressedRowId, setPressedRowId] = useState<string | null>(null);
  const [pressedColKey, setPressedColKey] = useState<string | null>(null);
  const hasRowMenu = Boolean(onInsertRow || onDeleteRow);
  const hasColMenu = Boolean(onInsertColumn || onDeleteColumn);

  const keyExtractor = useCallback((item: RowEntry<T>) => item.id, []);
  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({ length: rowHeight, offset: rowHeight * index, index }),
    [rowHeight],
  );

  return {
    // layout
    containerRef,
    containerWidth,
    onContainerLayout,
    colWidths,
    // reorder
    orderedColumns,
    boundaries,
    dragKey,
    dropIndex,
    gripHandlers,
    // sort
    activeSort,
    toggleSort,
    sortedRows,
    // selection
    selected,
    allSelected,
    someSelected,
    toggleAll,
    toggleRow,
    // menus
    pressedRowId,
    setPressedRowId,
    pressedColKey,
    setPressedColKey,
    hasRowMenu,
    hasColMenu,
    // rendering
    reduce,
    keyExtractor,
    getItemLayout,
    // loading state (needed by render callbacks in Table)
    loading,
    skeletonRows,
    emptyState,
    testID,
    // pass-through convenience
    onEndReached,
    onEndReachedThreshold,
    flatListHeight: height - rowHeight,
    rowHeight,
    selectable,
    onCellEdit,
    onInsertRow,
    onDeleteRow,
  };
}
