import type { ParsedWidth, RowEntry, SortState, TableColumn } from './table-types';
import { CHECKBOX_COL_WIDTH } from './table-types';

/**
 * Physical x → logical x, so everything downstream can ignore the direction.
 *
 * Boundaries accumulate in array order, which makes them logical: offset 0 is
 * where the *first* column starts. Under RTL the platform lays that column out
 * against the right edge instead (React Native flips `row` when
 * `I18nManager.isRTL`; the browser flips it from `dir`), while pointer
 * coordinates stay physical on both platforms — `pageX` grows rightwards
 * regardless. So the two disagree, and a pointer at physical `x` is at
 * `containerWidth - x` logically.
 *
 * The alternative — mirroring the boundary table — would push the flip into the
 * midpoint scan, the insertion index, and the commit. Doing it once here leaves
 * one axis to reason about.
 */
function toLogicalX(px: number, containerWidth: number, isRTL: boolean): number {
  return isRTL ? containerWidth - px : px;
}

function compareValues(av: unknown, bv: unknown, direction: SortState['direction']): number {
  let cmp: number;
  if (av === null && bv === null) cmp = 0;
  else if (av === null) cmp = 1;
  else if (bv === null) cmp = -1;
  else if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
  else cmp = String(av).localeCompare(String(bv));
  return direction === 'asc' ? cmp : -cmp;
}

export function parseColumnWidth(w: number | string | undefined): ParsedWidth {
  if (w === undefined || w === null) return { type: 'fr', value: 1 };
  if (typeof w === 'number') return { type: 'px', value: w };
  if (w.endsWith('px')) return { type: 'px', value: Number.parseFloat(w) };
  if (w.endsWith('fr')) return { type: 'fr', value: Number.parseFloat(w) };
  return { type: 'fr', value: 1 };
}

export function computeColumnWidths<T>(
  columns: TableColumn<T>[],
  containerWidth: number,
  selectable: boolean,
): Record<string, number> {
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

// Safe dynamic field read: rows are user-shaped objects keyed by column.key.
export function fieldValue(obj: unknown, key: string): unknown {
  return obj !== null && typeof obj === 'object' ? Reflect.get(obj, key) : undefined;
}

export function readCellValue<T>(row: T, column: TableColumn<T>): unknown {
  return fieldValue(row, column.key);
}

export function sortRows<T>(rows: RowEntry<T>[], sort: SortState | null, columns?: TableColumn<T>[]): RowEntry<T>[] {
  if (!sort) return rows;

  // Use getSortValue from the column definition when available; otherwise fall back to
  // reading `row[key]` directly so columns without a custom renderer still sort.
  const column = columns?.find((c) => c.key === sort.key);
  const getSortValue = column?.getSortValue;
  const getVal = getSortValue
    ? (entry: RowEntry<T>) => getSortValue(entry.row)
    : (entry: RowEntry<T>) => fieldValue(entry.row, sort.key);

  // Return the same reference if data is already in sorted order — avoids a new
  // array allocation and a FlatList reconciliation pass on every render.
  const alreadySorted = rows.every((row, i) => {
    if (i === 0) return true;
    const prev = rows[i - 1];
    if (prev === undefined) return true;
    return compareValues(getVal(prev), getVal(row), sort.direction) <= 0;
  });

  if (alreadySorted) return rows;

  return [...rows].sort((a, b) => compareValues(getVal(a), getVal(b), sort.direction));
}

/**
 * Cell alignment styles for a column.
 *
 * `left` and `right` are physical and stay that way — a column that asks for
 * `right` wants the right, and the caller is the only one who knows whether
 * that is a direction-relative choice or a deliberate one.
 *
 * The *default* is the interesting case. It pairs `alignItems: 'flex-start'`,
 * which is already direction-relative (the right-hand edge under RTL), with the
 * text alignment, so the two have to agree — a hard `left` would left-align the
 * text inside a right-aligned box.
 *
 * Hence the explicit `isRTL` rather than React Native's `textAlign: 'auto'`,
 * which looks like the obvious answer and does not work here:
 * react-native-web renders every `Text` with `dir="auto"`, so the browser infers
 * direction from the *content*. A Latin name in an Arabic table reports LTR and
 * anything direction-relative — `auto`, `start` — resolves to the left edge,
 * inside a cell that is aligned right.
 */
export function alignStyle(align: TableColumn<unknown>['align'], isRTL = false) {
  if (align === 'center') return { textAlign: 'center' as const, alignItems: 'center' as const };
  if (align === 'right') return { textAlign: 'right' as const, alignItems: 'flex-end' as const };
  if (align === 'left') return { textAlign: 'left' as const, alignItems: 'flex-start' as const };
  const textAlign = isRTL ? ('right' as const) : ('left' as const);
  return { textAlign, alignItems: 'flex-start' as const };
}

/**
 * Cumulative column edges along the *logical* axis: `edges[i]` is where ordered
 * column `i` begins, measured from wherever the first column starts, and the
 * trailing entry is the total content width. Offset 0 is the checkbox column
 * when the table is selectable.
 *
 * Logical, not physical, is the whole point — see {@link dropIndexAt}.
 */
export function columnBoundaries<T>(
  orderedColumns: TableColumn<T>[],
  colWidths: Record<string, number>,
  selectable: boolean,
): number[] {
  const edges: number[] = [];
  let x = selectable ? CHECKBOX_COL_WIDTH : 0;
  for (const col of orderedColumns) {
    edges.push(x);
    x += colWidths[col.key] ?? 0;
  }
  edges.push(x);
  return edges;
}

export type DropTargetArgs = {
  /** Pointer x relative to the container's left edge. Physical on both platforms. */
  px: number;
  /** Logical edges from {@link columnBoundaries}: one per column, plus the total. */
  boundaries: number[];
  containerWidth: number;
  isRTL: boolean;
};

/**
 * The insertion index a pointer is over, by comparing against each column's
 * midpoint. `0` inserts before the first column, `columns.length` after the last.
 */
export function dropIndexAt({ px, boundaries, containerWidth, isRTL }: DropTargetArgs): number {
  const count = Math.max(0, boundaries.length - 1);
  const x = toLogicalX(px, containerWidth, isRTL);
  for (let i = 0; i < count; i += 1) {
    const start = boundaries[i] ?? 0;
    const end = boundaries[i + 1] ?? start;
    if (x < start + (end - start) / 2) return i;
  }
  return count;
}

export type DropIndicatorArgs = Omit<DropTargetArgs, 'px'> & {
  dropIndex: number;
  /** Indicator width, kept inside the container so the last boundary stays visible. */
  thickness?: number;
};

/**
 * Physical `left` for the drop indicator at `dropIndex`.
 *
 * Physical because that is what absolute positioning takes: `left` is the left
 * edge in both directions, on both platforms — only `start`/`end` flip. Under
 * RTL the line therefore has to be placed at the mirror of its logical edge,
 * and sits just *before* it rather than just after.
 */
export function dropIndicatorX({ boundaries, dropIndex, containerWidth, isRTL, thickness = 2 }: DropIndicatorArgs): number {
  const edge = boundaries[dropIndex] ?? 0;
  if (isRTL) return Math.max(0, containerWidth - edge - thickness);
  return Math.min(edge, containerWidth - thickness);
}

export function alignToJustify(align: TableColumn<unknown>['align']): 'flex-end' | 'center' | 'flex-start' {
  if (align === 'right') return 'flex-end';
  if (align === 'center') return 'center';
  return 'flex-start';
}

export function nextSort(activeSort: SortState | null, key: string): SortState | null {
  if (activeSort?.key === key) {
    if (activeSort.direction === 'asc') return { key, direction: 'desc' };
    return null;
  }
  return { key, direction: 'asc' };
}

/**
 * Returns the flexbox style for a column's width.  When `resolvedWidth` is
 * known (from `computeColumnWidths` → `containerWidth`), every column gets an
 * explicit `width` — required inside a horizontal `ScrollView` where `flex`
 * cannot distribute space.  When it is unknown (initial render before layout),
 * fractional columns fall back to `flex` with a proportional `minWidth` so the
 * table still renders reasonable geometry.
 */
export function columnLayoutStyle(
  columnWidth: number | string | undefined,
  /** Known pixel width from `computeColumnWidths`. When available, all columns use explicit `width`. */
  resolvedWidth?: number,
): { width: number } | { flex: number; minWidth: number } {
  if (resolvedWidth !== undefined && resolvedWidth > 0) return { width: resolvedWidth };
  const parsed = parseColumnWidth(columnWidth);
  if (parsed.type === 'fr') {
    // Proportional floor: a 2fr column stays at least twice as wide as a 1fr one.
    return { flex: parsed.value, minWidth: Math.round(parsed.value * 80) };
  }
  return { width: parsed.value };
}
