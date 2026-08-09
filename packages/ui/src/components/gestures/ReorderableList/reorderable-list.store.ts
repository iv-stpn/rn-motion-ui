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

import { LayoutAnimation, Platform } from 'react-native';
import type { StoreApi } from 'zustand';
import { createStore, useStore } from 'zustand';
import type { DragPoint, DragRect } from '../drag.types';
import { insertionPosition, isPastThreshold, isTopHalf, reorderItems } from './reorderable-list-reorder';

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

/** Shallow reference equality for two string arrays (or null). */
function arraysEqual(a: string[] | null, b: string[] | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
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
  mode: 'indicator' | 'ghost';
  onReorder: (items: T[], fromIndex: number, toIndex: number) => void;
};

export type ReorderableListStore<T> = {
  // ── Reactive state ──────────────────────────────────────────────────
  /** The key of the item currently being dragged, or `null`. */
  draggedKey: string | null;
  /** Pre-reorder Animated.View rect snapshot — drives the FLIP position animation on drop. */
  flipRects: Map<string, DragRect> | null;
  /** The item that was dragged — uses a custom easing curve during the FLIP animation. */
  movedKey: string | null;
  /** Which item's zone the pointer is currently over, or `null`. */
  overKey: string | null;
  /** Whether the pointer is in the top half of the over-zone (`insert before` vs after). */
  insertBefore: boolean;
  /** Visual insertion position, or `null` when no valid landing spot exists. */
  indicatorIndex: number | null;
  /** When true, no item in the list can be dragged. */
  disabled: boolean;
  /** The current reorder mode — `'indicator'` (default) or `'ghost'`. */
  mode: 'indicator' | 'ghost';
  /**
   * Keys in visual preview order during a ghost-mode drag, or `null` when
   * no preview is active. In `'indicator'` mode this is always `null`.
   */
  previewKeys: string[] | null;
  /**
   * The key rendered as a ghost placeholder during ghost-mode drag.
   * The consumer's `renderItem` receives `isDragging: true` for this item.
   */
  ghostKey: string | null;

  // ── Actions ─────────────────────────────────────────────────────────
  /** Sync config from props. Called in render; cheap when nothing changed. */
  syncConfig: (config: ReorderableListStoreInit<T>) => void;
  onLift: (key: string) => void;
  onOver: (key: string, point: DragPoint) => void;
  onLeave: (key: string) => void;
  onDrop: (key: string, point: DragPoint) => void;
  onDragEnd: (key: string) => void;
  onMeasure: (key: string, rect: DragRect) => void;
  onMeasureView: (key: string, rect: DragRect) => void;
  onFlipComplete: () => void;
};

// ── Store factory ──────────────────────────────────────────────────────────

export function createReorderableListStore<T>(init: ReorderableListStoreInit<T>): StoreApi<ReorderableListStore<T>> {
  // Per-instance closure state — non-reactive (like useRef values).
  // Mutable from actions; reads do not trigger re-renders.
  let _items: readonly T[] = init.items;
  let _keys: readonly string[] = init.keys;
  let _onReorder = init.onReorder;
  const _rects = new Map<string, DragRect>();
  const _viewRects = new Map<string, DragRect>();

  return createStore<ReorderableListStore<T>>((set, get) => {
    /**
     * Ghost-mode `onOver` logic extracted to keep cognitive complexity under the
     * biome limit (25). Computes the preview order, bails out on no-ops, and
     * triggers FLIP snapshots when the preview changes.
     */
    function _onGhostOver(key: string, before: boolean, indicator: number | null, draggedKey: string): void {
      const ghostHeight = _rects.get(draggedKey)?.height;
      const result = insertionPosition({
        keys: _keys,
        draggedKey,
        rects: _rects,
        overKey: key,
        pointY: 0, // unused — isPastThreshold already decided `before`; we only need the index
        ghostHeight,
      });

      if (result === null) {
        set({ overKey: key, insertBefore: before, indicatorIndex: null, previewKeys: null });
        return;
      }

      const fromIndex = _keys.indexOf(draggedKey);
      const nextPreview = reorderItems(_keys, fromIndex, result.index);

      const prev = get();
      if (prev.overKey === key && prev.insertBefore === before && arraysEqual(prev.previewKeys, nextPreview)) return;

      const patch: Partial<ReorderableListStore<T>> = {
        overKey: key,
        insertBefore: before,
        indicatorIndex: indicator,
        previewKeys: nextPreview,
      };
      if (!arraysEqual(prev.previewKeys, nextPreview) && prev.flipRects === null) {
        patch.flipRects = new Map(_viewRects);
        patch.movedKey = null;
      }
      set(patch);
    }

    return {
      // ── Initial state ─────────────────────────────────────────────────
      draggedKey: null,
      flipRects: null,
      movedKey: null,
      overKey: null,
      insertBefore: false,
      indicatorIndex: null,
      disabled: init.disabled,
      mode: init.mode,
      previewKeys: null,
      ghostKey: null,

      // ── Config sync ───────────────────────────────────────────────────
      syncConfig(config) {
        _items = config.items;
        _keys = config.keys;
        _onReorder = config.onReorder;
        set({ disabled: config.disabled, mode: config.mode });
      },

      // ── Drag callbacks ────────────────────────────────────────────────
      onLift(key) {
        const { disabled, mode } = get();
        if (disabled) return;
        set(
          mode === 'ghost'
            ? { draggedKey: key, indicatorIndex: null, ghostKey: key, previewKeys: null }
            : { draggedKey: key, indicatorIndex: null },
        );
      },

      onOver(key, point) {
        const { draggedKey, mode } = get();
        if (draggedKey === null) return;
        const rect = _rects.get(key);
        if (rect === undefined) return;
        const ghostHeight = _rects.get(draggedKey)?.height;
        const before = mode === 'ghost' ? isPastThreshold(point.y, rect, ghostHeight) : isTopHalf(point.y, rect);
        const indicator = computeIndicatorIndex(draggedKey, key, before, _keys);

        if (mode === 'ghost') {
          _onGhostOver(key, before, indicator, draggedKey);
          return;
        }

        const { overKey, insertBefore } = get();
        if (overKey === key && insertBefore === before) return;
        set({ overKey: key, insertBefore: before, indicatorIndex: indicator });
      },

      onLeave(key) {
        const { overKey, mode } = get();
        if (overKey !== key) return;
        set(
          mode === 'ghost'
            ? { overKey: null, insertBefore: false, indicatorIndex: null, previewKeys: null }
            : { overKey: null, insertBefore: false, indicatorIndex: null },
        );
      },

      onDrop(key, point) {
        const { draggedKey, mode } = get();
        if (draggedKey === null) return;

        const fromIndex = _keys.indexOf(draggedKey);
        if (fromIndex === -1) {
          set({ draggedKey: null, overKey: null, insertBefore: false, indicatorIndex: null, previewKeys: null, ghostKey: null });
          return;
        }

        const ghostHeight = _rects.get(draggedKey)?.height;
        const result = insertionPosition({
          draggedKey,
          keys: _keys,
          overKey: key,
          pointY: point.y,
          rects: _rects,
          ghostHeight,
        });

        if (result === null || result.index === fromIndex) {
          set({ draggedKey: null, overKey: null, insertBefore: false, indicatorIndex: null, previewKeys: null, ghostKey: null });
          return;
        }

        if (mode === 'ghost') {
          // Items are already in preview order — commit without FLIP animation.
          _onReorder(reorderItems(_items, fromIndex, result.index), fromIndex, result.index);
          set({
            draggedKey: null,
            overKey: null,
            insertBefore: false,
            indicatorIndex: null,
            previewKeys: null,
            ghostKey: null,
          });
          return;
        }

        // Animate layout changes on native (react-native-web stub is a no-op).
        if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

        // Snapshot Animated.View rects before the reorder so the view can compute
        // FLIP offsets from the same element type.
        set({
          flipRects: new Map(_viewRects),
          movedKey: draggedKey,
        });

        _onReorder(reorderItems(_items, fromIndex, result.index), fromIndex, result.index);

        set({
          draggedKey: null,
          overKey: null,
          insertBefore: false,
          indicatorIndex: null,
        });
      },

      onDragEnd(_key) {
        set({ draggedKey: null, overKey: null, insertBefore: false, indicatorIndex: null, previewKeys: null, ghostKey: null });
      },

      onMeasure(key, rect) {
        _rects.set(key, rect);
      },

      onMeasureView(key, rect) {
        _viewRects.set(key, rect);
      },

      onFlipComplete() {
        set({ flipRects: null, movedKey: null });
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
