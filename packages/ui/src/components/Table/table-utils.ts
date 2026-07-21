import type { ParsedWidth, RowEntry, SortState, TableColumn } from './table-types';
import { CHECKBOX_COL_WIDTH } from './table-types';

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

export function sortRows<T>(rows: RowEntry<T>[], sort: SortState | null): RowEntry<T>[] {
  if (!sort) return rows;

  // Return the same reference if data is already in sorted order — avoids a new
  // array allocation and a FlatList reconciliation pass on every render.
  const alreadySorted = rows.every((row, i) => {
    if (i === 0) return true;
    const prev = rows[i - 1];
    if (prev === undefined) return true;
    return compareValues(fieldValue(prev.row, sort.key), fieldValue(row.row, sort.key), sort.direction) <= 0;
  });

  if (alreadySorted) return rows;

  return [...rows].sort((a, b) => compareValues(fieldValue(a.row, sort.key), fieldValue(b.row, sort.key), sort.direction));
}

export function alignStyle(align: TableColumn<unknown>['align']) {
  if (align === 'center') return { textAlign: 'center' as const, alignItems: 'center' as const };
  if (align === 'right') return { textAlign: 'right' as const, alignItems: 'flex-end' as const };
  return { textAlign: 'left' as const, alignItems: 'flex-start' as const };
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
