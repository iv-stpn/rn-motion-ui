import { MotiView } from 'moti';
import type { ReactNode, RefObject } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  type LayoutChangeEvent,
  type ListRenderItemInfo,
  PanResponder,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { ChevronUp, GripVertical, Plus, Trash2 } from '../../lib/icons';
import { Checkbox } from '../Checkbox/checkbox';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TableColumn<T> {
  key: string;
  header: string;
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  editable?: boolean;
  /** pixels string like "120px" or fraction "1.4fr" */
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  minWidth?: number;
}

export type SortDirection = 'asc' | 'desc';
export type SortState = { key: string; direction: SortDirection };

export interface TableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  getRowId?: (row: T, index: number) => string;
  // selection
  selectable?: boolean;
  selectedRowIds?: string[];
  defaultSelectedRowIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  // sorting (controllable)
  sort?: SortState | null;
  defaultSort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  // resize: no-op on RN (touch-only, no mouse drag on a resize handle)
  resizable?: boolean;
  /** Allow dragging a header grip to reorder columns. */
  reorderable?: boolean;
  /** Fires with the new column key order after a reorder drag commits. */
  onColumnOrderChange?: (keys: string[]) => void;
  // editable
  onCellEdit?: (rowId: string, key: string, value: string) => void;
  onColumnRename?: (key: string, value: string) => void;
  onInsertRow?: (index: number, position: 'before' | 'after') => void;
  onDeleteRow?: (rowId: string) => void;
  onInsertColumn?: (index: number, position: 'before' | 'after') => void;
  onDeleteColumn?: (key: string) => void;
  // layout
  rowHeight?: number;
  height?: number;
  overscan?: number;
  // async
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  loading?: boolean;
  skeletonRows?: number;
  emptyState?: ReactNode;
  // misc
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type ParsedWidth = { type: 'px'; value: number } | { type: 'fr'; value: number };

function parseColumnWidth(w: number | string | undefined): ParsedWidth {
  if (w == null) return { type: 'fr', value: 1 };
  if (typeof w === 'number') return { type: 'px', value: w };
  if (w.endsWith('px')) return { type: 'px', value: Number.parseFloat(w) };
  if (w.endsWith('fr')) return { type: 'fr', value: Number.parseFloat(w) };
  return { type: 'fr', value: 1 };
}

const CHECKBOX_COL_WIDTH = 44;

function computeColumnWidths<T>(columns: TableColumn<T>[], containerWidth: number, selectable: boolean): Record<string, number> {
  let totalFixed = selectable ? CHECKBOX_COL_WIDTH : 0;
  let totalFr = 0;

  const parsed = columns.map((col) => {
    const p = parseColumnWidth(col.width);
    if (p.type === 'px') totalFixed += p.value;
    else totalFr += p.value;
    return { key: col.key, p };
  });

  const remaining = Math.max(0, containerWidth - totalFixed);
  const result: Record<string, number> = {};
  for (const { key, p } of parsed) {
    if (p.type === 'px') result[key] = p.value;
    else result[key] = totalFr > 0 ? (remaining * p.value) / totalFr : 0;
  }
  return result;
}

function readCellValue<T>(row: T, column: TableColumn<T>): unknown {
  return (row as Record<string, unknown>)[column.key];
}

function sortRows<T>(rows: Array<{ row: T; id: string }>, sort: SortState | null): Array<{ row: T; id: string }> {
  if (!sort) return rows;
  return [...rows].sort((a, b) => {
    const av = (a.row as Record<string, unknown>)[sort.key];
    const bv = (b.row as Record<string, unknown>)[sort.key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    let cmp: number;
    if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
    else cmp = String(av).localeCompare(String(bv));
    return sort.direction === 'asc' ? cmp : -cmp;
  });
}

function alignStyle(align: TableColumn<unknown>['align']): object {
  if (align === 'center') return { textAlign: 'center' as const, alignItems: 'center' as const };
  if (align === 'right') return { textAlign: 'right' as const, alignItems: 'flex-end' as const };
  return { textAlign: 'left' as const, alignItems: 'flex-start' as const };
}

// ─── Column reorder (touch drag) ───────────────────────────────────────────────
// RN port of the web hook: instead of measuring header cells via
// getBoundingClientRect, we derive the drop boundary from the already-computed
// column pixel widths. A PanResponder on each header grip captures the drag,
// tracks the pointer's x within the container, and commits the new order on
// release.

function useColumnReorder<T>({
  columns,
  colWidths,
  selectable,
  containerRef,
  containerPageX,
  onColumnOrderChange,
}: {
  columns: TableColumn<T>[];
  colWidths: Record<string, number>;
  selectable: boolean;
  containerRef: RefObject<View | null>;
  containerPageX: RefObject<number>;
  onColumnOrderChange?: (keys: string[]) => void;
}) {
  const [order, setOrder] = useState<string[]>(() => columns.map((c) => c.key));
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // Apply the current order, tolerating columns added/removed at runtime. New
  // columns are placed at their position in `columns` (after their left
  // neighbor), not appended — so an inserted column lands where it was added.
  const orderedColumns = useMemo(() => {
    const byKey = new Map(columns.map((c) => [c.key, c]));
    const resultKeys = order.filter((k) => byKey.has(k));
    const present = new Set(resultKeys);
    columns.forEach((column, i) => {
      if (present.has(column.key)) return;
      let at = resultKeys.length;
      if (i === 0) at = 0;
      else {
        const prev = columns[i - 1] as TableColumn<T>;
        const idx = resultKeys.indexOf(prev.key);
        at = idx === -1 ? i : idx + 1;
      }
      resultKeys.splice(at, 0, column.key);
      present.add(column.key);
    });
    return resultKeys.map((k) => byKey.get(k)).filter((c): c is TableColumn<T> => c !== undefined);
  }, [order, columns]);

  // Cumulative left edges for each ordered column (offset 0 is the checkbox col).
  const boundaries = useMemo(() => {
    const edges: number[] = [];
    let x = selectable ? CHECKBOX_COL_WIDTH : 0;
    for (const col of orderedColumns) {
      edges.push(x);
      x += colWidths[col.key] ?? 0;
    }
    edges.push(x);
    return edges;
  }, [orderedColumns, colWidths, selectable]);

  // Live values read by the (cached) PanResponder callbacks — refreshed each
  // render so the stable responders never close over stale state.
  const ctx = useRef({ boundaries, orderedColumns, dropIndex, onColumnOrderChange });
  ctx.current = { boundaries, orderedColumns, dropIndex, onColumnOrderChange };

  // Map a container-relative x to an insertion index by comparing against each
  // ordered column's horizontal midpoint.
  const dropIndexFor = useCallback((px: number) => {
    const { boundaries: edges, orderedColumns: cols } = ctx.current;
    for (let i = 0; i < cols.length; i++) {
      const left = edges[i] ?? 0;
      const right = edges[i + 1] ?? left;
      if (px < left + (right - left) / 2) return i;
    }
    return cols.length;
  }, []);

  // Commit the reorder: move `key` to the current dropIndex, mirroring the web
  // hook's from/to adjustment. No-op (and no callback) if the order is unchanged.
  const commit = useCallback((key: string, di: number | null) => {
    if (di !== null) {
      const keys = ctx.current.orderedColumns.map((c) => c.key);
      const from = keys.indexOf(key);
      if (from !== -1) {
        const without = keys.filter((_, i) => i !== from);
        const to = from < di ? di - 1 : di;
        without.splice(to, 0, key);
        if (without.join(' ') !== keys.join(' ')) {
          setOrder(without);
          ctx.current.onColumnOrderChange?.(without);
        }
      }
    }
    setDragKey(null);
    setDropIndex(null);
  }, []);

  // One PanResponder per column key, created lazily and cached. Each claims the
  // gesture on touch (so a grip drag never triggers the header's sort/menu press)
  // and reads live geometry through `ctx`, so the cached instance stays correct
  // even as widths or order change.
  const responders = useRef<Record<string, ReturnType<typeof PanResponder.create>>>({});
  const gripHandlers = useCallback(
    (key: string) => {
      const existing = responders.current[key];
      if (existing) return existing.panHandlers;

      const toContainerX = (pageX: number) => pageX - (containerPageX.current ?? 0);
      const created = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          // Re-measure in case the table scrolled or moved since layout.
          containerRef.current?.measureInWindow?.((x) => {
            containerPageX.current = x;
          });
          setDragKey(key);
          setDropIndex(dropIndexFor(toContainerX(e.nativeEvent.pageX)));
        },
        onPanResponderMove: (e) => {
          setDropIndex(dropIndexFor(toContainerX(e.nativeEvent.pageX)));
        },
        onPanResponderRelease: () => commit(key, ctx.current.dropIndex),
        onPanResponderTerminate: () => commit(key, null),
      });
      responders.current[key] = created;
      return created.panHandlers;
    },
    [dropIndexFor, commit, containerRef, containerPageX],
  );

  return { orderedColumns, boundaries, dragKey, dropIndex, gripHandlers };
}

// ─── Internal: Editable Cell ─────────────────────────────────────────────────

function EditableCellInput({ value, onCommit, testID }: { value: string; onCommit: (next: string) => void; testID?: string }) {
  const [draft, setDraft] = useState(value);

  return (
    <TextInput
      value={draft}
      onChangeText={setDraft}
      onBlur={() => onCommit(draft)}
      onSubmitEditing={() => onCommit(draft)}
      placeholder="Empty"
      placeholderTextColor="rgba(0,0,0,0.25)"
      testID={testID}
      style={styles.editableInput}
      autoCapitalize="none"
      blurOnSubmit={true}
    />
  );
}

// ─── Internal: Skeleton row item ─────────────────────────────────────────────

function SkeletonCellPulse({ width, align, reduce }: { width: number; align: TableColumn<unknown>['align']; reduce: boolean }) {
  return (
    <View
      style={[
        styles.cell,
        { width, justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start' },
      ]}
    >
      <MotiView
        from={{ opacity: 0.5 }}
        animate={{ opacity: reduce ? 0.5 : 1 }}
        transition={{
          type: 'timing',
          duration: reduce ? 0 : 800,
          loop: !reduce,
          repeatReverse: true,
        }}
        style={{
          height: 12,
          borderRadius: 6,
          backgroundColor: '#e5e7eb',
          width: align === 'right' ? 40 : '60%',
        }}
      />
    </View>
  );
}

// ─── Main Table ───────────────────────────────────────────────────────────────

export function Table<T>({
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
  // resizable is accepted but no-op on RN (no mouse to drag a thin resize handle)
  resizable: _resizable,
  reorderable = false,
  onColumnOrderChange,
  onCellEdit,
  onColumnRename,
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
  style,
  testID,
}: TableProps<T>) {
  const reduce = useReducedMotion();

  // ── Container width + page-x measurement ──────────────────────────────────
  const containerRef = useRef<View | null>(null);
  const containerPageX = useRef(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
    // Cache the container's window x so reorder drags can map pageX → local x.
    containerRef.current?.measureInWindow?.((x) => {
      containerPageX.current = x;
    });
  }, []);

  const colWidths = useMemo(
    () => (containerWidth > 0 ? computeColumnWidths(columns, containerWidth, selectable) : {}),
    [columns, containerWidth, selectable],
  );

  // ── Column reorder (drag a header grip) ────────────────────────────────────
  const { orderedColumns, boundaries, dragKey, dropIndex, gripHandlers } = useColumnReorder({
    columns,
    colWidths,
    selectable,
    containerRef,
    containerPageX,
    onColumnOrderChange,
  });

  // ── Row entries ────────────────────────────────────────────────────────────
  const rows = useMemo(
    () =>
      data.map((row, index) => ({
        row,
        id: getRowId ? getRowId(row, index) : String(index),
      })),
    [data, getRowId],
  );

  // ── Sort state (controllable) ─────────────────────────────────────────────
  const isControlledSort = sortProp !== undefined;
  const [internalSort, setInternalSort] = useState<SortState | null>(defaultSort ?? null);
  const activeSort = isControlledSort ? (sortProp ?? null) : internalSort;

  const toggleSort = useCallback(
    (key: string) => {
      const next: SortState | null =
        activeSort?.key === key
          ? activeSort.direction === 'asc'
            ? { key, direction: 'desc' }
            : null
          : { key, direction: 'asc' };
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

  // ── Row actions: show on long-press ────────────────────────────────────────
  const [pressedRowId, setPressedRowId] = useState<string | null>(null);
  const [pressedColKey, setPressedColKey] = useState<string | null>(null);
  const hasRowMenu = !!(onInsertRow || onDeleteRow);
  const hasColMenu = !!(onInsertColumn || onDeleteColumn);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderHeaderCell = (column: TableColumn<T>, colIndex: number) => {
    const colWidth = colWidths[column.key] ?? 0;
    const isActive = activeSort?.key === column.key;
    const isColPressed = pressedColKey === column.key;
    const isDragging = dragKey === column.key;
    const { textAlign } = alignStyle(column.align) as { textAlign: 'left' | 'center' | 'right' };

    return (
      <Pressable
        key={column.key}
        style={[
          styles.headerCell,
          { width: containerWidth > 0 ? colWidth : undefined, flex: containerWidth > 0 ? undefined : 1 },
        ]}
        onLongPress={() => hasColMenu && setPressedColKey(isColPressed ? null : column.key)}
        onPress={column.sortable ? () => toggleSort(column.key) : undefined}
        accessibilityRole={column.sortable ? 'button' : undefined}
        accessibilityLabel={column.sortable ? `Sort by ${column.header}` : undefined}
        testID={`${testID ?? 'table'}-header-${column.key}`}
      >
        {/* Header content lifts (scale + fade) while its column is being dragged. */}
        <MotiView
          style={styles.headerInner}
          animate={reduce ? { opacity: isDragging ? 0.5 : 1 } : { scale: isDragging ? 1.04 : 1, opacity: isDragging ? 0.5 : 1 }}
          transition={{ type: 'timing', duration: reduce ? 0 : 180 }}
        >
          {/* Reorder grip — a PanResponder here claims the drag so it never sorts. */}
          {reorderable ? (
            <View
              {...gripHandlers(column.key)}
              style={styles.grip}
              hitSlop={8}
              accessibilityLabel={`Reorder ${column.key} column`}
              testID={`${testID ?? 'table'}-grip-${column.key}`}
            >
              <GripVertical size={14} color="#9ca3af" />
            </View>
          ) : null}

          {/* Rename input or label */}
          {onColumnRename && !column.sortable ? (
            <TextInput
              value={column.header}
              onChangeText={(v) => onColumnRename(column.key, v)}
              style={[styles.headerRenameInput, { textAlign }]}
              accessibilityLabel={`Rename ${column.key} column`}
            />
          ) : (
            <View
              style={[
                styles.headerLabelRow,
                {
                  justifyContent: column.align === 'right' ? 'flex-end' : column.align === 'center' ? 'center' : 'flex-start',
                },
              ]}
            >
              <Text
                selectable={false}
                style={[styles.headerText, isActive && styles.headerTextActive, { textAlign }]}
                numberOfLines={1}
              >
                {column.header}
              </Text>
              {column.sortable ? (
                <MotiView
                  animate={{
                    rotate: isActive && activeSort?.direction === 'desc' ? '180deg' : '0deg',
                    opacity: isActive ? 1 : 0.35,
                  }}
                  transition={{ type: 'timing', duration: reduce ? 0 : 180 }}
                >
                  <ChevronUp size={12} color={isActive ? '#111' : '#888'} />
                </MotiView>
              ) : null}
            </View>
          )}
        </MotiView>

        {/* Column action overlay on long-press */}
        {isColPressed && hasColMenu ? (
          <View style={styles.colActionBar}>
            {onInsertColumn ? (
              <Pressable
                style={styles.actionBtn}
                onPress={() => {
                  onInsertColumn(colIndex, 'before');
                  setPressedColKey(null);
                }}
                hitSlop={8}
              >
                <Plus size={10} color="#fff" />
              </Pressable>
            ) : null}
            {onDeleteColumn ? (
              <Pressable
                style={[styles.actionBtn, styles.actionBtnDestructive]}
                onPress={() => {
                  onDeleteColumn(column.key);
                  setPressedColKey(null);
                }}
                hitSlop={8}
              >
                <Trash2 size={10} color="#fff" />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </Pressable>
    );
  };

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<{ row: T; id: string }>) => {
      const { row, id } = item;
      const isSelected = selected.has(id);
      const isRowPressed = pressedRowId === id;

      return (
        <Pressable
          style={[styles.row, { height: rowHeight }]}
          onLongPress={() => hasRowMenu && setPressedRowId(isRowPressed ? null : id)}
          onPress={() => pressedRowId && setPressedRowId(null)}
          testID={`${testID ?? 'table'}-row-${id}`}
        >
          {/* Selected row background — spring fade */}
          <MotiView
            animate={{ opacity: isSelected ? 1 : 0 }}
            transition={reduce ? { type: 'timing', duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.selectedBg]}
          />

          {selectable ? (
            <View style={[styles.cell, { width: CHECKBOX_COL_WIDTH, justifyContent: 'center', alignItems: 'center' }]}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleRow(id)}
                accessibilityLabel={`Select row ${index + 1}`}
              />
            </View>
          ) : null}

          {orderedColumns.map((column) => {
            const colWidth = colWidths[column.key] ?? 0;
            const { textAlign } = alignStyle(column.align) as { textAlign: 'left' | 'center' | 'right' };
            const rawValue = readCellValue(row, column);

            return (
              <View
                key={column.key}
                style={[
                  styles.cell,
                  { width: containerWidth > 0 ? colWidth : undefined, flex: containerWidth > 0 ? undefined : 1 },
                ]}
              >
                {column.cell ? (
                  column.cell(row)
                ) : column.editable && !column.cell ? (
                  <EditableCellInput
                    value={rawValue == null ? '' : String(rawValue)}
                    onCommit={(v) => onCellEdit?.(id, column.key, v)}
                    testID={`${testID ?? 'table'}-cell-${id}-${column.key}`}
                  />
                ) : (
                  <Text style={[styles.cellText, { textAlign }]} numberOfLines={1}>
                    {rawValue == null ? '' : String(rawValue)}
                  </Text>
                )}
              </View>
            );
          })}

          {/* Row action buttons shown on long-press at right edge */}
          {isRowPressed && hasRowMenu ? (
            <View style={styles.rowActionBar}>
              {onInsertRow ? (
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => {
                    onInsertRow(index, 'before');
                    setPressedRowId(null);
                  }}
                  hitSlop={8}
                  accessibilityLabel={`Insert row before row ${index + 1}`}
                >
                  <Plus size={10} color="#fff" />
                </Pressable>
              ) : null}
              {onDeleteRow ? (
                <Pressable
                  style={[styles.actionBtn, styles.actionBtnDestructive]}
                  onPress={() => {
                    onDeleteRow(id);
                    setPressedRowId(null);
                  }}
                  hitSlop={8}
                  accessibilityLabel={`Delete row ${index + 1}`}
                >
                  <Trash2 size={10} color="#fff" />
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </Pressable>
      );
    },
    [
      orderedColumns,
      colWidths,
      containerWidth,
      selectable,
      selected,
      toggleRow,
      pressedRowId,
      hasRowMenu,
      onInsertRow,
      onDeleteRow,
      onCellEdit,
      rowHeight,
      reduce,
      testID,
    ],
  );

  const keyExtractor = useCallback((item: { id: string }) => item.id, []);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({ length: rowHeight, offset: rowHeight * index, index }),
    [rowHeight],
  );

  // ── Skeleton rows for loading state ───────────────────────────────────────

  const renderSkeletonRows = useCallback(
    (count: number) => (
      <View>
        {Array.from({ length: count }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows, fixed length, never reordered
          <View key={i} style={[styles.row, { height: rowHeight }]}>
            {selectable ? <View style={[styles.cell, { width: CHECKBOX_COL_WIDTH }]} /> : null}
            {orderedColumns.map((col) => {
              const colWidth = colWidths[col.key] ?? 0;
              return (
                <SkeletonCellPulse key={col.key} width={containerWidth > 0 ? colWidth : 80} align={col.align} reduce={reduce} />
              );
            })}
          </View>
        ))}
      </View>
    ),
    [orderedColumns, colWidths, containerWidth, selectable, rowHeight, reduce],
  );

  // ── Empty state ────────────────────────────────────────────────────────────

  const ListEmptyComponent = useMemo(() => {
    if (loading) return renderSkeletonRows(skeletonRows);
    return (
      <View style={styles.emptyContainer}>
        {typeof emptyState === 'string' ? <Text style={styles.emptyText}>{emptyState}</Text> : emptyState}
      </View>
    );
  }, [loading, skeletonRows, emptyState, renderSkeletonRows]);

  const ListFooterComponent = useMemo(
    () => (loading && sortedRows.length > 0 ? renderSkeletonRows(skeletonRows) : null),
    [loading, sortedRows.length, skeletonRows, renderSkeletonRows],
  );

  // ── Header height ──────────────────────────────────────────────────────────
  const flatListHeight = height - rowHeight; // header takes rowHeight

  return (
    <View style={[styles.container, { height }, style]} onLayout={onContainerLayout} testID={testID}>
      {/* ── Sticky Header ── */}
      <View style={[styles.headerRow, { height: rowHeight }]}>
        {selectable ? (
          <View style={[styles.headerCell, { width: CHECKBOX_COL_WIDTH, justifyContent: 'center', alignItems: 'center' }]}>
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onCheckedChange={toggleAll}
              accessibilityLabel="Select all rows"
              testID={`${testID ?? 'table'}-select-all`}
            />
          </View>
        ) : null}
        {orderedColumns.map((col, colIndex) => renderHeaderCell(col, colIndex))}

        {/* Drop indicator: a primary line at the insertion boundary while dragging. */}
        {dragKey && dropIndex !== null && containerWidth > 0 ? (
          <View
            pointerEvents="none"
            style={[styles.dropIndicator, { left: Math.min(boundaries[dropIndex] ?? 0, containerWidth - 2) }]}
          />
        ) : null}
      </View>

      {/* ── Body via FlatList ── */}
      <FlatList
        data={sortedRows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        style={{ height: flatListHeight }}
        showsVerticalScrollIndicator={false}
        onEndReached={onEndReached}
        onEndReachedThreshold={onEndReachedThreshold}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        removeClippedSubviews={true}
        testID={`${testID ?? 'table'}-list`}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: '#fff',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    backgroundColor: '#f9fafb',
    // Reorder drags start on the header grip; without this, a mouse drag selects
    // the header text and the native selection hijacks the pointer, so the
    // PanResponder never tracks the move. Suppress selection across the header.
    userSelect: 'none',
  },
  headerCell: {
    flexDirection: 'column',
    justifyContent: 'center',
    paddingHorizontal: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  headerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    flex: 1,
  },
  headerTextActive: {
    color: '#111827',
  },
  headerRenameInput: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    padding: 0,
    flex: 1,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  grip: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -4,
    userSelect: 'none',
  },
  dropIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#3b82f6',
    zIndex: 20,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.07)',
    overflow: 'hidden',
    position: 'relative',
  },
  selectedBg: {
    backgroundColor: 'rgba(59,130,246,0.05)',
  },
  cell: {
    justifyContent: 'center',
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  cellText: {
    fontSize: 13,
    color: '#111827',
  },
  editableInput: {
    fontSize: 13,
    color: '#111827',
    padding: 4,
    borderRadius: 4,
    flex: 1,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  rowActionBar: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  colActionBar: {
    position: 'absolute',
    top: 2,
    right: 2,
    flexDirection: 'row',
    gap: 2,
    zIndex: 10,
  },
  actionBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDestructive: {
    backgroundColor: '#ef4444',
  },
});
