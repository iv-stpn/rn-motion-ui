import type { RefObject } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { View } from 'react-native';
import { PanResponder } from 'react-native';
import type { TableColumn } from './table-types';
import { CHECKBOX_COL_WIDTH } from './table-types';

type UseColumnReorderArgs<T> = {
  columns: TableColumn<T>[];
  colWidths: Record<string, number>;
  selectable: boolean;
  containerRef: RefObject<View | null>;
  containerPageX: RefObject<number>;
  onColumnOrderChange?: (keys: string[]) => void;
};

type UseColumnReorderResult<T> = {
  orderedColumns: TableColumn<T>[];
  boundaries: number[];
  dragKey: string | null;
  dropIndex: number | null;
  gripHandlers: (key: string) => ReturnType<typeof PanResponder.create>['panHandlers'];
};

// RN port of the web column-reorder hook. Instead of measuring header cells via
// getBoundingClientRect, drop boundaries are derived from the already-computed
// column pixel widths. A PanResponder on each header grip captures the drag,
// tracks the pointer's x within the container, and commits the new order on release.
export function useColumnReorder<T>({
  columns,
  colWidths,
  selectable,
  containerRef,
  containerPageX,
  onColumnOrderChange,
}: UseColumnReorderArgs<T>): UseColumnReorderResult<T> {
  const [order, setOrder] = useState<string[]>(() => columns.map((c) => c.key));
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // Apply the current order, tolerating columns added/removed at runtime. New
  // columns are placed at their position in `columns` (after their left neighbor),
  // not appended — so an inserted column lands where it was added.
  const orderedColumns = useMemo(() => {
    const byKey = new Map(columns.map((c) => [c.key, c]));
    const resultKeys = order.filter((k) => byKey.has(k));
    const present = new Set(resultKeys);
    columns.forEach((column, i) => {
      if (present.has(column.key)) return;
      let at = resultKeys.length;
      if (i === 0) at = 0;
      else {
        const prev = columns[i - 1];
        const idx = prev ? resultKeys.indexOf(prev.key) : -1;
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
    for (let i = 0; i < cols.length; i += 1) {
      const left = edges[i] ?? 0;
      const right = edges[i + 1] ?? left;
      if (px < left + (right - left) / 2) return i;
    }
    return cols.length;
  }, []);

  // Commit the reorder: move `key` to the current dropIndex. No-op if unchanged.
  const commit = useCallback((key: string, di: number | null) => {
    if (di !== null) {
      const keys = ctx.current.orderedColumns.map((c) => c.key);
      const from = keys.indexOf(key);
      if (from !== -1) {
        const without = keys.filter((_, i) => i !== from);
        const to = from < di ? di - 1 : di;
        without.splice(to, 0, key);
        if (without.join(' ') !== keys.join(' ')) {
          setOrder(without);
          ctx.current.onColumnOrderChange?.(without);
        }
      }
    }
    setDragKey(null);
    setDropIndex(null);
  }, []);

  // One PanResponder per column key, created lazily and cached. Each claims the
  // gesture on touch so a grip drag never triggers the header's sort/menu press.
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
