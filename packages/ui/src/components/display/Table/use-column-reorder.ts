import type { RefObject } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { View } from 'react-native';
import { PanResponder } from 'react-native';
import { useIsRTL } from '../../../hooks/use-direction';
import type { TableColumn } from './table-types';
import { columnBoundaries, dropIndexAt, dropIndicatorX } from './table-utils';

type UseColumnReorderArgs<T> = {
  columns: TableColumn<T>[];
  colWidths: Record<string, number>;
  selectable: boolean;
  containerWidth: number;
  containerRef: RefObject<View | null>;
  containerPageX: RefObject<number>;
  onColumnOrderChange?: (keys: string[]) => void;
};

type UseColumnReorderResult<T> = {
  orderedColumns: TableColumn<T>[];
  /**
   * Physical `left` for the drop indicator, or null when there is nothing to
   * show. Resolved here rather than handed out as a boundary table so the
   * direction is reconciled in one place — see `toLogicalX` in table-utils.
   */
  indicatorX: number | null;
  dragKey: string | null;
  gripHandlers: (key: string) => ReturnType<typeof PanResponder.create>['panHandlers'];
};

// RN port of the web column-reorder hook. Instead of measuring header cells via
// getBoundingClientRect, drop boundaries are derived from the already-computed
// column pixel widths. A PanResponder on each header grip captures the drag,
// tracks the pointer's x within the container, and commits the new order on release.
//
// Those widths accumulate in column order, so the boundary table is *logical*
// while the pointer is physical. `dropIndexAt` reconciles the two — see
// `toLogicalX` in table-utils for why that has to happen somewhere.
export function useColumnReorder<T>({
  columns,
  colWidths,
  selectable,
  containerWidth,
  containerRef,
  containerPageX,
  onColumnOrderChange,
}: UseColumnReorderArgs<T>): UseColumnReorderResult<T> {
  const isRTL = useIsRTL();
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

  const boundaries = useMemo(
    () => columnBoundaries(orderedColumns, colWidths, selectable),
    [orderedColumns, colWidths, selectable],
  );

  // Live values read by the (cached) PanResponder callbacks — refreshed each
  // render so the stable responders never close over stale state.
  const ctx = useRef({ boundaries, dropIndex, containerWidth, isRTL, orderedColumns, onColumnOrderChange });
  ctx.current = { boundaries, dropIndex, containerWidth, isRTL, orderedColumns, onColumnOrderChange };

  const dropIndexFor = useCallback((px: number) => {
    const { boundaries: edges, containerWidth: width, isRTL: rtl } = ctx.current;
    return dropIndexAt({ px, boundaries: edges, containerWidth: width, isRTL: rtl });
  }, []);

  const indicatorX =
    dragKey !== null && dropIndex !== null && containerWidth > 0
      ? dropIndicatorX({ boundaries, dropIndex, containerWidth, isRTL })
      : null;

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

  return { orderedColumns, dragKey, indicatorX, gripHandlers };
}
