// A list whose items can be reordered by dragging.
//
// Built on the existing gesture primitives — `<Draggable>`, `<Dragzone>` and
// `<DragManager>` — so it inherits their transport story (HTML5 on web/mouse, a
// pan on touch and native) and their isolation model. Each item is both a source
// and a target, and the list decides where the dragged item would land by
// comparing the pointer position with the measured rect of whichever item it is
// over.
//
// Visual feedback during a drag:
//  - The dragged item is dimmed at its source position (`renderItem` receives
//    `isDragging: true`).
//  - An insertion indicator line appears at the projected landing spot.
//  - The ghost follows the pointer (drawn by the `<DragManager>` overlay).
//
// Items do not shift during the drag — the indicator is the only hint until
// the drop commits the reorder.
//
// State lives in a React context (one per list instance) so `<ReorderableItem>`
// can read state and call actions directly instead of receiving them as props.

import { createContext, type ReactNode, useCallback, useContext, useId, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { DragManager } from '../DragManager/drag-manager';
import type { DragPoint, DragRect } from '../drag.types';
import { ReorderableItem } from './reorderable-item';
import type { ReorderableListProps } from './reorderable-list.types';
import { computeIndicatorIndex, insertionPosition, isTopHalf, reorderItems } from './reorderable-list-reorder';

const DEFAULT_MIME = 'application/x-reorderable-item';

// ── Context ───────────────────────────────────────────────────────────────

type ReorderableListContextValue = {
  /** The key of the item currently being dragged, or `null`. */
  draggedKey: string | null;
  /** Visual insertion position, or `null` when no valid landing spot exists. */
  indicatorIndex: number | null;
  onLift: (key: string) => void;
  onOver: (key: string, point: DragPoint) => void;
  onLeave: (key: string) => void;
  onDrop: (key: string, point: DragPoint) => void;
  onDragEnd: (key: string) => void;
  onMeasure: (key: string, rect: DragRect) => void;
};

const ReorderableListContext = createContext<ReorderableListContextValue | null>(null);

// ── Insertion indicator ──────────────────────────────────────────────────

type InsertionIndicatorProps = {
  /** `'above'` anchors to the top edge, `'below'` to the bottom. */
  position: 'above' | 'below';
  testID?: string;
};

/**
 * A horizontal bar with terminal circles at each end, marking where the
 * dragged item will land — patterned after the Pragmatic Drag and Drop
 * drop indicator.
 *
 * Absolutely positioned so it floats above the items without occupying
 * layout space. The terminal circles sit flush against the line — no gap —
 * forming one continuous indicator.
 */
function InsertionIndicator({ position: pos, testID }: InsertionIndicatorProps) {
  const edge = pos === 'above' ? 'top-0 -translate-y-1/2' : 'bottom-0 translate-y-1/2';
  return (
    <View testID={testID} className={`pointer-events-none absolute right-0 left-0 z-10 flex-row items-center ${edge}`}>
      <View className="h-2 w-2 rounded-full bg-primary" />
      <View className="h-0.5 flex-1 rounded-full bg-primary" />
      <View className="h-2 w-2 rounded-full bg-primary" />
    </View>
  );
}

// ── Item-list view ───────────────────────────────────────────────────────

type ReorderableListViewProps<T> = {
  className?: string;
  disabled: boolean;
  items: readonly T[];
  keys: readonly string[];
  listId: string;
  mimeType: string;
  onReorder: (items: T[], fromIndex: number, toIndex: number) => void;
  renderItem: (item: T, index: number, isDragging: boolean) => ReactNode;
  testID?: string;
};

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: the view holds drag state, callbacks, context, and rendering in one cohesive component — splitting would require prop-drilling refs across function boundaries
function ReorderableListView<T>({
  className,
  disabled,
  items,
  keys,
  listId,
  mimeType,
  onReorder,
  renderItem,
  testID,
}: ReorderableListViewProps<T>) {
  // ── Drag state ──────────────────────────────────────────────────────────
  // `draggedKey` and `indicatorIndex` are React state because the list view
  // needs them to render the dimmed item and the insertion indicator. The rest
  // of the drag bookkeeping (`overKey`, `insertBefore`) is never rendered, so it
  // lives in refs — read and written by the stable callbacks without re-renders.
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [indicatorIndex, setIndicatorIndex] = useState<number | null>(null);

  // Refs let the stable callbacks read fresh values per invocation without
  // re-creating themselves — the same pattern the SortableList uses for its
  // closure state.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const keysRef = useRef(keys);
  keysRef.current = keys;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  // Per-instance drag bookkeeping — non-reactive (like useRef values).
  const rectsRef = useRef(new Map<string, DragRect>());
  const draggedKeyRef = useRef<string | null>(null);
  const overKeyRef = useRef<string | null>(null);
  const insertBeforeRef = useRef(false);

  // ── Drag callbacks — stable identity across renders ─────────────────────
  const clearDrag = useCallback(() => {
    draggedKeyRef.current = null;
    overKeyRef.current = null;
    insertBeforeRef.current = false;
    setDraggedKey(null);
    setIndicatorIndex(null);
  }, []);

  const onLift = useCallback(
    (key: string) => {
      if (disabled) return;
      draggedKeyRef.current = key;
      setDraggedKey(key);
      setIndicatorIndex(null);
    },
    [disabled],
  );

  const onOver = useCallback((key: string, point: DragPoint) => {
    const dragged = draggedKeyRef.current;
    if (dragged === null) return;
    const rect = rectsRef.current.get(key);
    if (rect === undefined) return;
    const before = isTopHalf(point.y, rect);
    const indicator = computeIndicatorIndex(dragged, key, before, keysRef.current);

    if (overKeyRef.current === key && insertBeforeRef.current === before) return;
    overKeyRef.current = key;
    insertBeforeRef.current = before;
    setIndicatorIndex(indicator);
  }, []);

  const onLeave = useCallback((key: string) => {
    if (overKeyRef.current !== key) return;
    overKeyRef.current = null;
    insertBeforeRef.current = false;
    setIndicatorIndex(null);
  }, []);

  const onDrop = useCallback(
    (key: string, point: DragPoint) => {
      const dragged = draggedKeyRef.current;
      if (dragged === null) return;

      const fromIndex = keysRef.current.indexOf(dragged);
      if (fromIndex === -1) {
        clearDrag();
        return;
      }

      const result = insertionPosition({
        draggedKey: dragged,
        keys: keysRef.current,
        overKey: key,
        pointY: point.y,
        rects: rectsRef.current,
      });

      if (result === null || result.index === fromIndex) {
        clearDrag();
        return;
      }

      onReorderRef.current(reorderItems(itemsRef.current, fromIndex, result.index), fromIndex, result.index);
      clearDrag();
    },
    [clearDrag],
  );

  const onDragEnd = useCallback(
    (_key: string) => {
      clearDrag();
    },
    [clearDrag],
  );

  const onMeasure = useCallback((key: string, rect: DragRect) => {
    rectsRef.current.set(key, rect);
  }, []);

  const contextValue = useMemo<ReorderableListContextValue>(
    () => ({
      draggedKey,
      indicatorIndex,
      onDragEnd,
      onDrop,
      onLeave,
      onLift,
      onMeasure,
      onOver,
    }),
    [draggedKey, indicatorIndex, onDragEnd, onDrop, onLeave, onLift, onMeasure, onOver],
  );

  return (
    <ReorderableListContext.Provider value={contextValue}>
      <View className={className}>
        {keys.map((key, renderIdx) => {
          const item = items[renderIdx];
          if (item === undefined) return null;

          const isDimmed = key === draggedKey;
          const showAbove = indicatorIndex !== null && indicatorIndex === renderIdx;
          const isLast = renderIdx === keys.length - 1;
          const showBelow = isLast && indicatorIndex === keys.length;

          const indicatorTestID = testID ? `${testID}-indicator` : undefined;
          const itemTestID = testID ? `${testID}-item-${key}` : undefined;

          return (
            <View key={key} className="relative">
              {showAbove ? <InsertionIndicator position="above" testID={indicatorTestID} /> : null}
              <ReorderableItem disabled={disabled} itemKey={key} listId={listId} mimeType={mimeType} testID={itemTestID}>
                {renderItem(item, renderIdx, isDimmed)}
              </ReorderableItem>
              {showBelow ? <InsertionIndicator position="below" testID={indicatorTestID} /> : null}
            </View>
          );
        })}
      </View>
    </ReorderableListContext.Provider>
  );
}

// ── Public component ─────────────────────────────────────────────────────

/**
 * A drag-to-reorder list.
 *
 * ```tsx
 * <ReorderableList
 *   items={todos}
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
 * **Isolation.** The list wraps itself in a `<DragManager isolate>`, so items
 * cannot be dragged into another list and foreign drags cannot enter. Two
 * `<ReorderableList>`s on the same page are independent.
 *
 * **Accessibility.** A drag is pointer-only on every platform. Every reorder
 * **must** be reachable through a second path — a "Move up / Move down" menu,
 * keyboard shortcuts — or the action does not exist for part of your users.
 * The `<DragManager>` is the natural place for that second path: its `onDrop`
 * fires for every drop in the list, so the commands that perform the same moves
 * belong at this level.
 */
export function ReorderableList<T>({
  items,
  onReorder,
  renderItem,
  keyExtractor,
  mimeType = DEFAULT_MIME,
  ref,
  disabled = false,
  className,
  testID,
}: ReorderableListProps<T>) {
  const listId = useId();
  const keys = useMemo(() => items.map((item, index) => keyExtractor(item, index)), [items, keyExtractor]);

  return (
    <DragManager ref={ref} isolate={true} testID={testID}>
      <ReorderableListView
        className={className}
        disabled={disabled}
        items={items}
        keys={keys}
        listId={listId}
        mimeType={mimeType}
        onReorder={onReorder}
        renderItem={renderItem}
        testID={testID}
      />
    </DragManager>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: hook paired with its component
export function useReorderableList(): ReorderableListContextValue {
  const ctx = useContext(ReorderableListContext);
  if (ctx === null) throw new Error('useReorderableList must be used inside a <ReorderableList>');
  return ctx;
}
