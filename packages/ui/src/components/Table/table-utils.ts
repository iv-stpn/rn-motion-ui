import type { ParsedWidth, RowEntry, SortState, TableColumn } from './table-types';
import { CHECKBOX_COL_WIDTH } from './table-types';

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
  return [...rows].sort((a, b) => {
    const av = fieldValue(a.row, sort.key);
    const bv = fieldValue(b.row, sort.key);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    let cmp: number;
    if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
    else cmp = String(av).localeCompare(String(bv));
    return sort.direction === 'asc' ? cmp : -cmp;
  });
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
