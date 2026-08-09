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
import { DragManager } from '../DragManager/drag-manager';
import { reorderItems } from '../ReorderableList/reorderable-list-reorder';
import { SortableItem } from './sortable-item';
import type { SortableListProps } from './sortable-list.types';

const DEFAULT_MIME = 'application/x-sortable-item';

// ── Context ───────────────────────────────────────────────────────────────

type SortableListContextValue = {
  /** Index of the dragged item, or -1 when idle. */
  activeIndex: number;
  /** The key of the dragged item, or null when idle. */
  draggedKey: string | null;
  /** Where the dragged item would land, or null when idle. */
  insertionIndex: number | null;
  /** Fixed height of every item. */
  itemHeight: number;
  /** Each commit increments this — items use it to skip the exit animation and snap instead. */
  dropVersion: number;
  onDragEnd: (key: string, canceled: boolean) => void;
  onDragMove: (translationY: number) => void;
  onDragStart: (index: number, key: string) => void;
};

const SortableListContext = createContext<SortableListContextValue | null>(null);

export function useSortableList(): SortableListContextValue {
  const ctx = useContext(SortableListContext);
  if (ctx === null) throw new Error('useSortableList must be used inside a <SortableList>');
  return ctx;
}

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
  const [activeIndex, setActiveIndex] = useState(-1);
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null);
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dropVersion, setDropVersion] = useState(0);

  // Refs let the stable callbacks read fresh values per invocation without
  // re-creating themselves — the same pattern the existing drag store uses
  // for its closure state.
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const insertionIndexRef = useRef(insertionIndex);
  insertionIndexRef.current = insertionIndex;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const keysRef = useRef(keys);
  keysRef.current = keys;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  // ── Drag callbacks — stable identity across renders ─────────────────────
  const handleDragStart = useCallback((index: number, key: string) => {
    activeIndexRef.current = index;
    insertionIndexRef.current = index;
    setActiveIndex(index);
    setInsertionIndex(index);
    setDraggedKey(key);
  }, []);

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
      setInsertionIndex((prev) => (prev === clamped ? prev : clamped));
    },
    [itemHeight],
  );

  const handleDragEnd = useCallback((_key: string, _canceled: boolean) => {
    const from = activeIndexRef.current;
    const to = insertionIndexRef.current;
    if (from !== -1 && to !== null && from !== to) {
      const currentItems = itemsRef.current;
      const commit = onReorderRef.current;
      const newItems = reorderItems(currentItems, from, to);
      commit(newItems, from, to);
      setDropVersion((v) => v + 1);
    }
    activeIndexRef.current = -1;
    insertionIndexRef.current = null;
    setActiveIndex(-1);
    setInsertionIndex(null);
    setDraggedKey(null);
  }, []);

  const contextValue = useMemo<SortableListContextValue>(
    () => ({
      activeIndex,
      draggedKey,
      dropVersion,
      insertionIndex,
      itemHeight,
      onDragEnd: handleDragEnd,
      onDragMove: handleDragMove,
      onDragStart: handleDragStart,
    }),
    [activeIndex, draggedKey, dropVersion, insertionIndex, itemHeight, handleDragEnd, handleDragMove, handleDragStart],
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
