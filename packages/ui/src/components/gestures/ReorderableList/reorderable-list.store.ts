// Zustand store for `<ReorderableList>`.
//
// A store-factory pattern with a module-level registry ("store of stores")
// keyed by a unique list ID. This lets `<ReorderableItem>` read list state
// and call list actions without receiving them as props — the item just
// needs the list ID and its own key.
//
// The registry mirrors the drag-store.ts module-level Map pattern (where
// Dragzone and Draggable find each other across subtrees), but uses Zustand
// instead of a hand-rolled `useSyncExternalStore` for the reactive binding.
//
// Indicator-mode only. For real-time visual reordering during drag, see
// `<SortableList>`.

import type { StoreApi } from 'zustand';
import { createStore, useStore } from 'zustand';
import type { DragPoint, DragRect } from '../drag.types';
import { insertionPosition, isTopHalf, reorderItems } from './reorderable-list-reorder';

// ── Helpers ────────────────────────────────────────────────────────────────

function computeIndicatorIndex(
  draggedKey: string | null,
  overKey: string | null,
  insertBefore: boolean,
  keys: readonly string[],
): number | null {
  if (draggedKey === null || overKey === null) return null;

  const overIdx = keys.indexOf(overKey);
  if (overIdx === -1) return null;

  const visualIdx = insertBefore ? overIdx : overIdx + 1;
  const draggedIdx = keys.indexOf(draggedKey);

  // Suppress when the visual insertion would be a no-op (same position).
  if (visualIdx === draggedIdx || visualIdx === draggedIdx + 1) return null;
  return visualIdx;
}

// ── Global registry ────────────────────────────────────────────────────────

/** Module-level registry: one store per list instance. */
// biome-ignore lint/suspicious/noExplicitAny: registry stores heterogeneous generic stores; the type parameter is only used for config sync which is cast back at lookup
const storeRegistry = new Map<string, StoreApi<ReorderableListStore<any>>>();

// ── Types ──────────────────────────────────────────────────────────────────

export type ReorderableListStoreInit<T> = {
  items: readonly T[];
  keys: readonly string[];
  disabled: boolean;
  onReorder: (items: T[], fromIndex: number, toIndex: number) => void;
};

export type ReorderableListStore<T> = {
  // ── Reactive state ──────────────────────────────────────────────────
  /** The key of the item currently being dragged, or `null`. */
  draggedKey: string | null;
  /** Which item's zone the pointer is currently over, or `null`. */
  overKey: string | null;
  /** Whether the pointer is in the top half of the over-zone (`insert before` vs after). */
  insertBefore: boolean;
  /** Visual insertion position, or `null` when no valid landing spot exists. */
  indicatorIndex: number | null;
  /** When true, no item in the list can be dragged. */
  disabled: boolean;

  // ── Actions ─────────────────────────────────────────────────────────
  /** Sync config from props. Called in render; cheap when nothing changed. */
  syncConfig: (config: ReorderableListStoreInit<T>) => void;
  onLift: (key: string) => void;
  onOver: (key: string, point: DragPoint) => void;
  onLeave: (key: string) => void;
  onDrop: (key: string, point: DragPoint) => void;
  onDragEnd: (key: string) => void;
  onMeasure: (key: string, rect: DragRect) => void;
};

// ── Store factory ──────────────────────────────────────────────────────────

export function createReorderableListStore<T>(init: ReorderableListStoreInit<T>): StoreApi<ReorderableListStore<T>> {
  // Per-instance closure state — non-reactive (like useRef values).
  // Mutable from actions; reads do not trigger re-renders.
  let _items: readonly T[] = init.items;
  let _keys: readonly string[] = init.keys;
  let _onReorder = init.onReorder;
  const _rects = new Map<string, DragRect>();

  return createStore<ReorderableListStore<T>>((set, get) => {
    return {
      // ── Initial state ─────────────────────────────────────────────────
      draggedKey: null,
      overKey: null,
      insertBefore: false,
      indicatorIndex: null,
      disabled: init.disabled,

      // ── Config sync ───────────────────────────────────────────────────
      syncConfig(config) {
        _items = config.items;
        _keys = config.keys;
        _onReorder = config.onReorder;
        set({ disabled: config.disabled });
      },

      // ── Drag callbacks ────────────────────────────────────────────────
      onLift(key) {
        const { disabled } = get();
        if (disabled) return;
        set({ draggedKey: key, indicatorIndex: null });
      },

      onOver(key, point) {
        const { draggedKey } = get();
        if (draggedKey === null) return;
        const rect = _rects.get(key);
        if (rect === undefined) return;
        const before = isTopHalf(point.y, rect);
        const indicator = computeIndicatorIndex(draggedKey, key, before, _keys);

        const { overKey, insertBefore } = get();
        if (overKey === key && insertBefore === before) return;
        set({ overKey: key, insertBefore: before, indicatorIndex: indicator });
      },

      onLeave(key) {
        const { overKey } = get();
        if (overKey !== key) return;
        set({ overKey: null, insertBefore: false, indicatorIndex: null });
      },

      onDrop(key, point) {
        const { draggedKey } = get();
        if (draggedKey === null) return;

        const fromIndex = _keys.indexOf(draggedKey);
        if (fromIndex === -1) {
          set({ draggedKey: null, overKey: null, insertBefore: false, indicatorIndex: null });
          return;
        }

        const result = insertionPosition({
          draggedKey,
          keys: _keys,
          overKey: key,
          pointY: point.y,
          rects: _rects,
        });

        if (result === null || result.index === fromIndex) {
          set({ draggedKey: null, overKey: null, insertBefore: false, indicatorIndex: null });
          return;
        }

        _onReorder(reorderItems(_items, fromIndex, result.index), fromIndex, result.index);

        set({
          draggedKey: null,
          overKey: null,
          insertBefore: false,
          indicatorIndex: null,
        });
      },

      onDragEnd(_key) {
        set({ draggedKey: null, overKey: null, insertBefore: false, indicatorIndex: null });
      },

      onMeasure(key, rect) {
        _rects.set(key, rect);
      },
    };
  });
}

// ── Registry API ───────────────────────────────────────────────────────────

/**
 * Get or create a store for the given list.
 *
 * If a store already exists for `listId`, its config is synced with the
 * latest `init` values (so prop changes take effect) and the existing
 * store is returned. Otherwise a new store is created and registered.
 */
export function getOrCreateReorderableListStore<T>(
  listId: string,
  init: ReorderableListStoreInit<T>,
): StoreApi<ReorderableListStore<T>> {
  const existing = storeRegistry.get(listId);
  if (existing) {
    const typed = existing as StoreApi<ReorderableListStore<T>>;
    typed.getState().syncConfig(init);
    return typed;
  }
  const store = createReorderableListStore<T>(init);
  storeRegistry.set(listId, store);
  return store;
}

/** Remove a store from the registry (called on list unmount). */
export function removeReorderableListStore(listId: string): void {
  storeRegistry.delete(listId);
}

/**
 * Subscribe to a slice of a ReorderableList store by list ID.
 *
 * Throws if no store is registered for `listId` — the hook must be called
 * inside a `<ReorderableList>` subtree.
 */
export function useReorderableListStore<T, R>(listId: string, selector: (state: ReorderableListStore<T>) => R): R {
  const store = storeRegistry.get(listId);
  if (!store)
    throw new Error(
      `useReorderableListStore: no store found for list "${listId}". Ensure it is called inside a <ReorderableList> subtree.`,
    );
  return useStore(store as StoreApi<ReorderableListStore<T>>, selector);
}
