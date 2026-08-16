// A list whose items visually reorder in real-time as you drag.
//
// Built on the existing gesture primitives — <Draggable>, <Dragzone> and
// <DragManager> — so it inherits their transport story and isolation model.
// Each item is both a source and a target, and the list decides where the
// dragged item would land from the finger's vertical translation alone — no
// rect measurement, no FLIP snapshots, no tree reordering during the drag.
//
// Visual feedback during a drag:
//  - The dragged item is dimmed at its preview position (`renderItem` receives
//    `isDragging: true`).
//  - Other items smoothly animate their translateY to close the gap left by
//    the dragged item or make room for it.
//  - The floating ghost follows the pointer (drawn by the <DragManager> overlay).
//
// The reorder commits on drop; cancelling reverts items to their original
// positions.
//
// State lives in a React context (one per list instance) so <SortableItem> can
// read state and call actions directly instead of receiving them as props.

import { createContext, type ReactNode, useCallback, useContext, useId, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';
import { DragManager } from '../DragManager/drag-manager';
import { reorderItems } from '../ReorderableList/reorderable-list-reorder';
import { SortableItem } from './sortable-item';
import type { SortableListProps } from './sortable-list.types';

const DEFAULT_MIME = 'application/x-sortable-item';

// ── Context ───────────────────────────────────────────────────────────────

type SortableListContextValue = {
  /** Index of the dragged item, or -1 when idle. Kept as React state so `renderItem`
   *  can derive `isDragging` from it. */
  activeIndex: number;
  /** Index of the dragged item as a SharedValue — what worklets read on the UI thread. */
  activeIndexSV: SharedValue<number>;
  /** The key of the dragged item, or null when idle. */
  draggedKey: string | null;
  /** Where the dragged item would land — a SharedValue updated per frame without
   *  triggering React re-renders. -1 when idle. */
  insertionIndexSV: SharedValue<number>;
  /** Fixed height of every item. */
  itemHeight: number;
  /** Each commit increments this — items read it in a worklet to snap instead of
   *  animating when the canonical order changes. */
  dropVersionSV: SharedValue<number>;
  onDragEnd: (key: string, canceled: boolean) => void;
  onDragMove: (translationY: number) => void;
  onDragStart: (index: number, key: string) => void;
};

const SortableListContext = createContext<SortableListContextValue | null>(null);

// ── List view ─────────────────────────────────────────────────────────────

type SortableListViewProps<T> = {
  className?: string;
  disabled: boolean;
  itemHeight: number;
  items: readonly T[];
  keys: readonly string[];
  listId: string;
  mimeType: string;
  onReorder: (items: T[], fromIndex: number, toIndex: number) => void;
  renderItem: (item: T, index: number, isDragging: boolean) => ReactNode;
  renderPreview?: (item: T, index: number) => ReactNode;
  testID?: string;
};

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: the view wires shared values, drag callbacks, context, and rendering in one cohesive component — splitting would require prop-drilling refs and shared values across function boundaries
function SortableListView<T>({
  className,
  disabled,
  itemHeight,
  items,
  keys,
  listId,
  mimeType,
  onReorder,
  renderItem,
  renderPreview,
  testID,
}: SortableListViewProps<T>) {
  // ── Drag state ──────────────────────────────────────────────────────────
  // `activeIndex` and `draggedKey` stay as React state because the list view
  // needs them for `isDragging` in renderItem.  `insertionIndex` and
  // `dropVersion` are SharedValues — updated per frame without re-renders,
  // read by items on the UI thread via useAnimatedReaction.
  const [activeIndex, setActiveIndex] = useState(-1);
  const [draggedKey, setDraggedKey] = useState<string | null>(null);

  const activeIndexSV = useSharedValue(-1);
  const insertionIndexSV = useSharedValue(-1);
  const dropVersionSV = useSharedValue(0);

  // Refs let the stable callbacks read fresh values per invocation without
  // re-creating themselves — the same pattern the existing drag store uses
  // for its closure state.
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const keysRef = useRef(keys);
  keysRef.current = keys;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  // ── Drag callbacks — stable identity across renders ─────────────────────
  const handleDragStart = useCallback(
    (index: number, key: string) => {
      activeIndexRef.current = index;
      activeIndexSV.value = index;
      insertionIndexSV.value = index;
      setActiveIndex(index);
      setDraggedKey(key);
    },
    [activeIndexSV, insertionIndexSV],
  );

  const handleDragMove = useCallback(
    (translationY: number) => {
      const from = activeIndexRef.current;
      if (from === -1) return;
      const count = itemsRef.current.length;
      // Symmetric rounding — JS Math.round sends -0.5 to 0 (toward +∞) which
      // makes upward drags lag by half a slot.  Round away from zero so upward
      // and downward drags are symmetric.
      const raw = translationY / itemHeight;
      const slots = raw >= 0 ? Math.floor(raw + 0.5) : Math.ceil(raw - 0.5);
      const clamped = Math.max(0, Math.min(count - 1, from + slots));
      // Write the shared value directly — no setState, no re-render.
      // Items read this on the UI thread via useAnimatedReaction.
      if (insertionIndexSV.value !== clamped) insertionIndexSV.value = clamped;
    },
    [itemHeight, insertionIndexSV],
  );

  const handleDragEnd = useCallback(
    (_key: string, canceled: boolean) => {
      const from = activeIndexRef.current;
      const to = insertionIndexSV.value;
      if (!canceled && from !== -1 && to !== -1 && from !== to) {
        // Commit atomically, in this same JS tick: bump the drop version so
        // items snap to their post-reorder positions (no withTiming), hand the
        // reordered array to the consumer, and only then reset the shared
        // values — all BEFORE React re-renders with the new canonical order.
        // A reaction re-init (its `index` dep changed) can therefore never
        // evaluate against stale active/insertion indices: it sees ai === -1
        // and computes a target of 0 at its new index. Previously the shared
        // values were reset in a useLayoutEffect AFTER the reorder render, so
        // re-inits read the drag-time values and wrote multi-slot wrong
        // transforms — the drop jitter.
        dropVersionSV.value = dropVersionSV.value + 1;
        const currentItems = itemsRef.current;
        const commit = onReorderRef.current;
        commit(reorderItems(currentItems, from, to), from, to);
      }
      // Reset all drag state — shared values first so the re-render (commit
      // and cancel alike) evaluates every item at its rest position. The
      // cancel path relies on this: with ai === -1 the reaction animates items
      // back to 0 with withTiming(200) instead of snapping.
      activeIndexSV.value = -1;
      insertionIndexSV.value = -1;
      activeIndexRef.current = -1;
      setActiveIndex(-1);
      setDraggedKey(null);
    },
    [activeIndexSV, dropVersionSV, insertionIndexSV],
  );

  const contextValue = useMemo<SortableListContextValue>(
    () => ({
      activeIndex,
      activeIndexSV,
      draggedKey,
      dropVersionSV,
      insertionIndexSV,
      itemHeight,
      onDragEnd: handleDragEnd,
      onDragMove: handleDragMove,
      onDragStart: handleDragStart,
    }),
    [
      activeIndex,
      activeIndexSV,
      draggedKey,
      dropVersionSV,
      insertionIndexSV,
      itemHeight,
      handleDragEnd,
      handleDragMove,
      handleDragStart,
    ],
  );

  return (
    <SortableListContext.Provider value={contextValue}>
      <View className={className}>
        {items.map((item, i) => {
          const key = keys[i];
          if (key === undefined) return null;
          const isDragging = i === activeIndex;
          const itemTestID = testID ? `${testID}-item-${key}` : undefined;

          return (
            <SortableItem
              key={key}
              disabled={disabled}
              index={i}
              itemKey={key}
              listId={listId}
              mimeType={mimeType}
              preview={renderPreview?.(item, i)}
              testID={itemTestID}
            >
              {renderItem(item, i, isDragging)}
            </SortableItem>
          );
        })}
      </View>
    </SortableListContext.Provider>
  );
}

// ── Public component ──────────────────────────────────────────────────────

/**
 * A drag-to-reorder list where items visually reorder in real-time.
 *
 * ```tsx
 * <SortableList
 *   items={todos}
 *   itemHeight={60}
 *   onReorder={(items, from, to) => setTodos(items)}
 *   renderItem={(todo, _i, isDragging) => (
 *     <View className={isDragging ? 'opacity-40' : ''}>
 *       <Text>{todo.title}</Text>
 *     </View>
 *   )}
 *   keyExtractor={(todo) => todo.id}
 * />
 * ```
 *
 * **How it works.** Unlike the indicator-mode ReorderableList, items never
 * re-render in a different order during the drag. Each item computes its
 * visual position as a pure function of `(index, activeIndex, insertionIndex)`
 * and animates `translateY` to reach it. The insertion index itself is derived
 * from the finger's vertical translation — `Math.round(translation.y /
 * itemHeight)` — a pure arithmetic that needs no measured rects.
 *
 * **Isolation.** The list wraps itself in a `<DragManager isolate>`, so items
 * cannot be dragged into another list and foreign drags cannot enter. Two
 * `<SortableList>`s on the same page are independent.
 *
 * **Fixed height.** Every item must share the same height, passed as the
 * required `itemHeight` prop. For variable-height items use
 * `<ReorderableList>` (indicator mode) instead.
 *
 * **Accessibility.** A drag is pointer-only on every platform; every reorder
 * **must** be reachable through a second path — a "Move up / Move down" menu,
 * keyboard shortcuts — or the action does not exist for part of your users.
 */
export function SortableList<T>({
  items,
  onReorder,
  renderItem,
  renderPreview,
  keyExtractor,
  itemHeight,
  mimeType = DEFAULT_MIME,
  ref,
  disabled = false,
  className,
  testID,
}: SortableListProps<T>) {
  const listId = useId();
  const keys = useMemo(() => items.map((item, i) => keyExtractor(item, i)), [items, keyExtractor]);

  return (
    <DragManager ref={ref} isolate={true} testID={testID}>
      <SortableListView
        className={className}
        disabled={disabled}
        itemHeight={itemHeight}
        items={items}
        keys={keys}
        listId={listId}
        mimeType={mimeType}
        onReorder={onReorder}
        renderItem={renderItem}
        renderPreview={renderPreview}
        testID={testID}
      />
    </DragManager>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: hook paired with its component
export function useSortableList(): SortableListContextValue {
  const ctx = useContext(SortableListContext);
  if (ctx === null) throw new Error('useSortableList must be used inside a <SortableList>');
  return ctx;
}
