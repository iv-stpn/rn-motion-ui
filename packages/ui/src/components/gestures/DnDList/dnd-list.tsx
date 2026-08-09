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

import { type ReactNode, useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, LayoutAnimation, Platform, View } from 'react-native';
import { DragManager } from '../DragManager/drag-manager';
import type { DragPoint, DragRect } from '../drag.types';
import { DnDItem } from './dnd-item';
import type { DnDListProps } from './dnd-list.types';
import { insertionPosition, isTopHalf, reorderItems } from './dnd-reorder';

const DEFAULT_MIME = 'application/x-dnd-item';

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

type DnDListViewProps<T> = {
  disabled: boolean;
  draggedKey: string | null;
  /** Snapshot of item rects before the reorder — drives the FLIP animation. */
  flipRects: Map<string, DragRect> | null;
  /** The item that was dragged — uses a custom easing curve; pushed items use linear. */
  movedKey: string | null;
  indicatorIndex: number | null;
  items: readonly T[];
  keys: readonly string[];
  keyExtractor: (item: T, index: number) => string;
  listGroup: string;
  mimeType: string;
  overKey: string | null;
  renderItem: (item: T, index: number, isDragging: boolean) => ReactNode;
  testID?: string;
  onDragEnd: (key: string) => void;
  onDrop: (key: string, point: DragPoint) => void;
  /** Called after the FLIP animation completes, so the parent can clear flip state. */
  onFlipComplete: () => void;
  onLeave: (key: string) => void;
  onLift: (key: string) => void;
  onMeasure: (key: string, rect: DragRect) => void;
  /** Populates the viewRectsRef — Animated.View measurements, same element FLIP remeasures. */
  onMeasureView: (key: string, rect: DragRect) => void;
  onOver: (key: string, point: DragPoint) => void;
};

function DnDListView<T>({
  disabled,
  draggedKey,
  flipRects,
  movedKey,
  indicatorIndex,
  items,
  keys,
  keyExtractor,
  listGroup,
  mimeType,
  overKey,
  renderItem,
  testID,
  onDragEnd,
  onDrop,
  onFlipComplete,
  onLeave,
  onLift,
  onMeasure,
  onMeasureView,
  onOver,
}: DnDListViewProps<T>) {
  const dragging = draggedKey !== null;

  // ── FLIP animation state ──────────────────────────────────────────────
  // Two progress values so the moved item and pushed items can use different easing curves.
  const flipMoved = useRef(new Animated.Value(0)).current;
  const flipPushed = useRef(new Animated.Value(0)).current;
  const [itemOffsets, setItemOffsets] = useState<Map<string, number> | null>(null);
  // biome-ignore lint/suspicious/noExplicitAny: Animated.View ref callback parameter is LegacyRef<View>, not assignable to View | null
  const itemRefs = useRef<Map<string, any>>(new Map());

  // Whether a FLIP animation is in progress (offsets rendered, progress running).
  const isFlipping = itemOffsets !== null && itemOffsets.size > 0;

  useLayoutEffect(() => {
    if (!flipRects) return;

    // Gather measurement promises for every item currently in the list.
    const targets: [string, View][] = [];
    for (const [key, ref] of itemRefs.current) {
      if (ref) targets.push([key, ref]);
    }

    if (targets.length === 0) {
      onFlipComplete();
      return;
    }

    const measurePromises = targets.map(
      ([key, ref]) =>
        new Promise<{ key: string; y: number } | null>((resolve) => {
          ref.measureInWindow((_x, y) => resolve({ key, y }));
        }),
    );

    Promise.all(measurePromises).then((results) => {
      const offsets = new Map<string, number>();
      for (const r of results) {
        if (r) {
          const oldRect = flipRects.get(r.key);
          if (oldRect) {
            const delta = oldRect.y - r.y;
            if (Math.abs(delta) > 0.5) offsets.set(r.key, delta);
          }
        }
      }

      if (offsets.size === 0) {
        onFlipComplete();
        return;
      }

      // Apply offsets so items render at their pre-reorder visual positions.
      setItemOffsets(offsets);

      // Start the animation on the next frame so the offset render is committed.
      // The moved item uses a custom easing curve; pushed items move linearly.
      requestAnimationFrame(() => {
        flipMoved.setValue(0);
        flipPushed.setValue(0);
        Animated.parallel([
          Animated.timing(flipMoved, {
            toValue: 1,
            duration: 200,
            easing: Easing.out(Easing.back(1.5)),
            useNativeDriver: false,
          }),
          Animated.timing(flipPushed, {
            toValue: 1,
            duration: 200,
            easing: Easing.linear,
            useNativeDriver: false,
          }),
        ]).start(() => {
          setItemOffsets(null);
          onFlipComplete();
        });
      });
    });
    // flipMoved/flipPushed are stable refs, onFlipComplete is a stable useCallback.
  }, [flipRects, flipMoved, flipPushed, onFlipComplete]);

  // Clear stale refs when the key set changes (items added/removed/reordered).
  const prevKeysRef = useRef<readonly string[]>(keys);
  if (prevKeysRef.current !== keys) {
    itemRefs.current = new Map();
    prevKeysRef.current = keys;
  }

  // Continuously measure Animated.View positions so viewRectsRef stays current
  // for the FLIP snapshot. Uses itemRefs (Map<string, any>) to avoid the
  // Animated.View LegacyRef type mismatch — measureInWindow is available at runtime.
  useLayoutEffect(() => {
    for (const [key, ref] of itemRefs.current) {
      if (ref)
        ref.measureInWindow((x: number, y: number, width: number, height: number) => {
          onMeasureView(key, { height, width, x, y });
        });
    }
  });

  return (
    <View>
      {items.map((item, index) => {
        const key = keys[index] ?? keyExtractor(item, index);
        const isDragged = key === draggedKey;
        const isOver = key === overKey && !isDragged;
        const showAbove = indicatorIndex !== null && indicatorIndex === index;
        const isLast = index === items.length - 1;
        const showBelow = isLast && indicatorIndex === items.length;

        // FLIP offset for this item: moved item uses custom easing, pushed items use linear.
        const initialOffset = itemOffsets?.get(key) ?? 0;
        const progress = key === movedKey ? flipMoved : flipPushed;
        const translateY =
          isFlipping && initialOffset !== 0 ? progress.interpolate({ inputRange: [0, 1], outputRange: [initialOffset, 0] }) : 0;

        return (
          <Animated.View
            key={key}
            // biome-ignore lint/performance/noJsxPropsBind: ref callbacks in .map cannot be pre-bound per-key
            ref={(node) => {
              if (node) itemRefs.current.set(key, node);
            }}
            className="relative"
            style={{ transform: [{ translateY }] }}
          >
            {showAbove ? <InsertionIndicator position="above" testID={testID ? `${testID}-indicator` : undefined} /> : null}
            <DnDItem
              disabled={disabled}
              eligibleClassName={dragging && !isDragged ? 'bg-surface-hover/50' : undefined}
              itemKey={key}
              listGroup={listGroup}
              mimeType={mimeType}
              onDragEnd={onDragEnd}
              onDrop={onDrop}
              onLeave={onLeave}
              onLift={onLift}
              onMeasure={onMeasure}
              onOver={onOver}
              overClassName={isOver ? 'bg-surface-selected ring-1 ring-primary/20' : undefined}
              testID={testID ? `${testID}-item-${key}` : undefined}
            >
              {renderItem(item, index, isDragged)}
            </DnDItem>
            {showBelow ? <InsertionIndicator position="below" testID={testID ? `${testID}-indicator` : undefined} /> : null}
          </Animated.View>
        );
      })}
    </View>
  );
}

// ── State hook ───────────────────────────────────────────────────────────

type DnDListState = {
  draggedKey: string | null;
  /** Pre-reorder Animated.View rect snapshot — drives the FLIP position animation on drop. */
  flipRects: Map<string, DragRect> | null;
  /** The item that was dragged — uses a custom easing curve during the FLIP animation. */
  movedKey: string | null;
  indicatorIndex: number | null;
  listGroup: string;
  overKey: string | null;
  onDragEnd: (key: string) => void;
  onDrop: (key: string, point: DragPoint) => void;
  /** Called by DnDListView when the FLIP animation finishes. */
  onFlipComplete: () => void;
  onLeave: (key: string) => void;
  onLift: (key: string) => void;
  onMeasure: (key: string, rect: DragRect) => void;
  /** Populated from Animated.View measurements — same element the FLIP effect remeasures. */
  onMeasureView: (key: string, rect: DragRect) => void;
  onOver: (key: string, point: DragPoint) => void;
};

function useDnDListState<T>(
  items: readonly T[],
  keys: readonly string[],
  disabled: boolean,
  onReorder: DnDListProps<T>['onReorder'],
): DnDListState {
  const listGroup = useId();

  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [flipRects, setFlipRects] = useState<Map<string, DragRect> | null>(null);
  const [movedKey, setMovedKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [insertBefore, setInsertBefore] = useState(false);

  const draggedRef = useRef<string | null>(null);
  const rectsRef = useRef<Map<string, DragRect>>(new Map());
  /** Animated.View measurements — same element the FLIP effect measures, so coordinate spaces match. */
  const viewRectsRef = useRef<Map<string, DragRect>>(new Map());

  const resetDragState = useCallback(() => {
    draggedRef.current = null;
    setDraggedKey(null);
    setOverKey(null);
    setInsertBefore(false);
  }, []);

  const onFlipComplete = useCallback(() => {
    setFlipRects(null);
    setMovedKey(null);
  }, []);

  const onLift = useCallback(
    (key: string) => {
      if (disabled) return;
      draggedRef.current = key;
      setDraggedKey(key);
    },
    [disabled],
  );

  const onOver = useCallback(
    (key: string, point: DragPoint) => {
      if (draggedRef.current === null) return;
      const rect = rectsRef.current.get(key);
      if (rect === undefined) return;
      const before = isTopHalf(point.y, rect);
      setOverKey((prev) => (prev === key && before === insertBefore ? prev : key));
      setInsertBefore(before);
    },
    [insertBefore],
  );

  const onLeave = useCallback((key: string) => {
    setOverKey((prev) => (prev === key ? null : prev));
  }, []);

  const onDrop = useCallback(
    (key: string, point: DragPoint) => {
      const dragged = draggedRef.current;
      if (dragged === null) return;

      const fromIndex = keys.indexOf(dragged);
      if (fromIndex === -1) {
        resetDragState();
        return;
      }

      const result = insertionPosition({
        draggedKey: dragged,
        keys,
        overKey: key,
        pointY: point.y,
        rects: rectsRef.current,
      });

      if (result === null || result.index === fromIndex) {
        resetDragState();
        return;
      }

      // Animate layout changes on native (react-native-web stub is a no-op).
      if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      // Snapshot Animated.View rects before the reorder so the view can compute FLIP offsets.
      // Uses viewRectsRef (Animated.View measurements), not rectsRef (Dragzone measurements),
      // so both old and new positions come from the same element via the same measureInWindow call.
      setFlipRects(new Map(viewRectsRef.current));
      // Remember which item was dragged so moved/pushed items get different easing curves.
      setMovedKey(dragged);

      onReorder(reorderItems(items, fromIndex, result.index), fromIndex, result.index);
      resetDragState();
    },
    [items, keys, onReorder, resetDragState],
  );

  const onDragEnd = useCallback(
    (_key: string) => {
      resetDragState();
    },
    [resetDragState],
  );

  const onMeasure = useCallback((key: string, rect: DragRect) => {
    rectsRef.current.set(key, rect);
  }, []);

  const onMeasureView = useCallback((key: string, rect: DragRect) => {
    viewRectsRef.current.set(key, rect);
  }, []);

  const indicatorIndex = useMemo(() => {
    if (draggedKey === null || overKey === null) return null;
    const overIdx = keys.indexOf(overKey);
    if (overIdx === -1) return null;
    const visualIdx = insertBefore ? overIdx : overIdx + 1;
    const draggedIdx = keys.indexOf(draggedKey);
    if (visualIdx === draggedIdx || visualIdx === draggedIdx + 1) return null;
    return visualIdx;
  }, [draggedKey, overKey, insertBefore, keys]);

  return {
    draggedKey,
    flipRects,
    movedKey,
    indicatorIndex,
    listGroup,
    overKey,
    onDragEnd,
    onDrop,
    onFlipComplete,
    onLeave,
    onLift,
    onMeasure,
    onMeasureView,
    onOver,
  };
}

// ── Public component ─────────────────────────────────────────────────────

/**
 * A drag-to-reorder list.
 *
 * ```tsx
 * <DnDList
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
 * `<DnDList>`s on the same page are independent.
 *
 * **Accessibility.** A drag is pointer-only on every platform. Every reorder
 * **must** be reachable through a second path — a "Move up / Move down" menu,
 * keyboard shortcuts — or the action does not exist for part of your users.
 * The `<DragManager>` is the natural place for that second path: its `onDrop`
 * fires for every drop in the list, so the commands that perform the same moves
 * belong at this level.
 */
export function DnDList<T>({
  items,
  onReorder,
  renderItem,
  keyExtractor,
  mimeType = DEFAULT_MIME,
  ref,
  disabled = false,
  testID,
}: DnDListProps<T>) {
  const keys = useMemo(() => items.map((item, index) => keyExtractor(item, index)), [items, keyExtractor]);
  const state = useDnDListState<T>(items, keys, disabled, onReorder);

  return (
    <DragManager ref={ref} isolate={true} testID={testID}>
      <DnDListView
        disabled={disabled}
        draggedKey={state.draggedKey}
        flipRects={state.flipRects}
        movedKey={state.movedKey}
        indicatorIndex={state.indicatorIndex}
        items={items}
        keys={keys}
        keyExtractor={keyExtractor}
        listGroup={state.listGroup}
        mimeType={mimeType}
        overKey={state.overKey}
        renderItem={renderItem}
        testID={testID}
        onDragEnd={state.onDragEnd}
        onDrop={state.onDrop}
        onFlipComplete={state.onFlipComplete}
        onLeave={state.onLeave}
        onLift={state.onLift}
        onMeasure={state.onMeasure}
        onMeasureView={state.onMeasureView}
        onOver={state.onOver}
      />
    </DragManager>
  );
}
