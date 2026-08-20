// biome-ignore-all lint/style/noExcessiveLinesPerFile: SortableItem reads the list context while the list renders SortableItem — co-located to break the list↔item require cycle
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

import {
  createContext,
  memo,
  type ReactNode,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Draggable } from '../Draggable/draggable';
import { DragManager } from '../DragManager/drag-manager';
import { Dragzone } from '../Dragzone/dragzone';
import type { DragEndEvent, DragMoveEvent, DragzoneAcceptEvent, DragzoneHandle } from '../drag.types';
import { reorderItems } from '../ReorderableList/reorderable-list-reorder';
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

// ── Item ─────────────────────────────────────────────────────────────────

type SortableItemProps = {
  children: ReactNode;
  /** Stable unique key for this item, from the consumer's `keyExtractor`. */
  itemKey: string;
  /** Canonical index in the items array. */
  index: number;
  /** The group id shared by all items in this list — matches Dragzone and Draggable. */
  listId: string;
  /** MIME type written to the drag transfer. */
  mimeType: string;
  /** When true, this item is neither draggable nor a drop target. */
  disabled?: boolean;
  /** Optional custom ghost content for the drag preview. */
  preview?: ReactNode;
  testID?: string;
};

/**
 * Compute where an item at `ownIndex` should visually appear, given the active
 * (dragged) item at `activeIndex` and the insertion point at `insertionIndex`.
 *
 * - The active item itself moves to `insertionIndex`.
 * - Items between the old and new positions shift by one slot to close the gap.
 * - Items outside the affected range stay put.
 *
 * Returns the item's visual index in the preview order.
 */
function computeTargetIndex(ownIndex: number, activeIndex: number, insertionIndex: number): number {
  'worklet';
  if (activeIndex === -1 || activeIndex === insertionIndex) return ownIndex;
  if (ownIndex === activeIndex) return insertionIndex;

  if (activeIndex < insertionIndex) {
    // Dragging downward: items between active+1 and insertion shift up by 1.
    if (ownIndex > activeIndex && ownIndex <= insertionIndex) return ownIndex - 1;
  } else if (ownIndex >= insertionIndex && ownIndex < activeIndex) {
    // Dragging upward: items between insertion and active-1 shift down by 1.
    return ownIndex + 1;
  }

  return ownIndex;
}

/**
 * One row in a sortable list — a drop target that can also be picked up.
 *
 * Reads drag state from the SortableList context so it needs no callback props
 * of its own beyond the structural ones (itemKey, index, listId, mimeType).
 */
function SortableItem({ children, itemKey, index, listId, mimeType, disabled = false, preview, testID }: SortableItemProps) {
  const zoneRef = useRef<DragzoneHandle>(null);

  const { activeIndexSV, dropVersionSV, insertionIndexSV, itemHeight, onDragEnd, onDragMove, onDragStart } = useSortableList();

  // ── Reanimated-driven position ──────────────────────────────────────────
  // translateY is driven entirely on the UI thread via useAnimatedReaction,
  // which watches the shared values for activeIndex and insertionIndex.
  // This eliminates per-frame JS bridge hops and React re-renders during the
  // drag — only the commit (onDrop) crosses back to JS.
  const translateY = useSharedValue(0);
  const lastDropVersion = useSharedValue(0);
  // Previous canonical index — lets the drop-commit layout effect run only when
  // a reorder actually changed this item's slot, not on every render.
  const prevIndexRef = useRef(index);

  useAnimatedReaction(
    () => {
      const ai = activeIndexSV.value;
      const ii = insertionIndexSV.value;
      if (ai === -1 || ii === -1) return 0;
      const target = computeTargetIndex(index, ai, ii);
      return (target - index) * itemHeight;
    },
    (targetTY, prevTY) => {
      if (dropVersionSV.value !== lastDropVersion.value) {
        // Commit just happened — snap to the new canonical position instantly
        // rather than animating from the drag-time offset.
        lastDropVersion.value = dropVersionSV.value;
        translateY.value = targetTY;
      } else if (prevTY !== null && targetTY !== prevTY) translateY.value = withTiming(targetTY, { duration: 200 });
      else if (prevTY === null) translateY.value = targetTY;
    },
    [index, itemHeight],
  );

  // ── Drop-commit snap ────────────────────────────────────────────────────
  // The reaction above animates translateY while a drag is in flight, but it is
  // a `useEffect`-driven hook — its reset lands *after* paint. On a committed
  // reorder the item's `index` changes in the very render that re-inserts its
  // DOM node at the new slot, so resetting translateY in a layout effect makes
  // the snap and the reorder land in the same frame. Without this, the re-inserted
  // node briefly renders at its new slot while still carrying the drag-time
  // offset — the drop flicker. Syncing `lastDropVersion` here also makes the
  // reaction's post-paint re-init settle to a no-op instead of re-animating.
  useLayoutEffect(() => {
    if (prevIndexRef.current === index) return;
    prevIndexRef.current = index;
    translateY.value = 0;
    lastDropVersion.value = dropVersionSV.value;
  }, [index, translateY, lastDropVersion, dropVersionSV]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: itemHeight,
    transform: [{ translateY: translateY.value }],
  }));

  // ── Drag callbacks — wire itemKey into the list-level handlers ──────────
  const handleDragStart = useCallback(() => {
    onDragStart(index, itemKey);
  }, [index, itemKey, onDragStart]);

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      onDragMove(event.translation.y);
    },
    [onDragMove],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      onDragEnd(itemKey, event.canceled);
    },
    [itemKey, onDragEnd],
  );

  // Reject self-drops: the dragged item's key is in the transfer.
  const accepts = useCallback(
    (event: DragzoneAcceptEvent) => {
      if (disabled || event.drag === null) return false;
      return event.transfer.getData(mimeType) !== itemKey;
    },
    [disabled, itemKey, mimeType],
  );

  return (
    <Animated.View style={animatedStyle}>
      <Dragzone ref={zoneRef} accepts={accepts} disabled={disabled} groups={[listId]} skipRectMeasure={true}>
        <Draggable
          data={{ [mimeType]: itemKey }}
          disabled={disabled}
          groups={[listId]}
          onDragEnd={handleDragEnd}
          onDragMove={handleDragMove}
          onDragStart={handleDragStart}
          preview={preview}
          testID={testID}
        >
          {children}
        </Draggable>
      </Dragzone>
    </Animated.View>
  );
}

// ── Item slot — memoized per item ────────────────────────────────────────

type SortableItemSlotProps = {
  children: ReactNode;
  disabled: boolean;
  index: number;
  isDragging: boolean;
  /** The raw item — compared by reference in the memo comparator, not rendered. */
  item: unknown;
  itemKey: string;
  listId: string;
  mimeType: string;
  preview?: ReactNode;
  testID?: string;
};

/**
 * One row of the list, memoized so a reorder commit re-renders only the items
 * whose canonical index actually changed (the moved items) instead of every
 * row's Dragzone/Draggable subtree. The comparator deliberately ignores
 * `children` and `preview`: for an unmoved item those are a pure function of
 * (item, index, isDragging), so skipping their re-render is exactly the win.
 */
function SortableItemSlot({ children, disabled, index, itemKey, listId, mimeType, preview, testID }: SortableItemSlotProps) {
  return (
    <SortableItem
      disabled={disabled}
      index={index}
      itemKey={itemKey}
      listId={listId}
      mimeType={mimeType}
      preview={preview}
      testID={testID}
    >
      {children}
    </SortableItem>
  );
}

function sortableItemSlotPropsEqual(prev: SortableItemSlotProps, next: SortableItemSlotProps): boolean {
  return (
    prev.item === next.item &&
    prev.index === next.index &&
    prev.isDragging === next.isDragging &&
    prev.disabled === next.disabled &&
    prev.testID === next.testID
  );
}

const MemoizedSortableItemSlot = memo(SortableItemSlot, sortableItemSlotPropsEqual);

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
        dropVersionSV.value += 1;
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
            <MemoizedSortableItemSlot
              key={key}
              disabled={disabled}
              index={i}
              isDragging={isDragging}
              item={item}
              itemKey={key}
              listId={listId}
              mimeType={mimeType}
              preview={renderPreview?.(item, i)}
              testID={itemTestID}
            >
              {renderItem(item, i, isDragging)}
            </MemoizedSortableItemSlot>
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
