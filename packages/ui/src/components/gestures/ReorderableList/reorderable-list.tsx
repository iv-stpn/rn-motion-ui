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
// State lives in a Zustand store (one per list instance, held in a module-level
// registry) so `<ReorderableItem>` can read state and call actions directly
// instead of receiving them as props.

import { type ReactNode, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { DragManager } from '../DragManager/drag-manager';
import { ReorderableItem } from './reorderable-item';
import { getOrCreateReorderableListStore, removeReorderableListStore, useReorderableListStore } from './reorderable-list.store';
import type { ReorderableListProps } from './reorderable-list.types';

const DEFAULT_MIME = 'application/x-reorderable-item';

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
  renderItem: (item: T, index: number, isDragging: boolean) => ReactNode;
  renderPreview?: (item: T, index: number) => ReactNode;
  testID?: string;
};

function ReorderableListView<T>({
  className,
  disabled,
  items,
  keys,
  listId,
  mimeType,
  renderItem,
  renderPreview,
  testID,
}: ReorderableListViewProps<T>) {
  // ── Read from the list's Zustand store ────────────────────────────────
  const draggedKey = useReorderableListStore(listId, (s) => s.draggedKey);
  const flipRects = useReorderableListStore(listId, (s) => s.flipRects);
  const movedKey = useReorderableListStore(listId, (s) => s.movedKey);
  const indicatorIndex = useReorderableListStore(listId, (s) => s.indicatorIndex);
  const mode = useReorderableListStore(listId, (s) => s.mode);
  const previewKeys = useReorderableListStore(listId, (s) => s.previewKeys);
  const ghostKey = useReorderableListStore(listId, (s) => s.ghostKey);
  const onFlipComplete = useReorderableListStore(listId, (s) => s.onFlipComplete);
  const onMeasureView = useReorderableListStore(listId, (s) => s.onMeasureView);

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
          Animated.timing(flipMoved, { toValue: 1, duration: 300, easing: Easing.out(Easing.back(1.2)), useNativeDriver: false }),
          Animated.timing(flipPushed, {
            toValue: 1,
            duration: 300,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            useNativeDriver: false,
          }),
        ]).start(() => {
          setItemOffsets(null);
          onFlipComplete();
        });
      });
    });
    // flipMoved/flipPushed are stable refs, onFlipComplete is a stable store action.
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

  // ── Ghost mode: build a key→item lookup for preview-order rendering ──
  const isGhostMode = mode === 'ghost';
  const itemByKey =
    isGhostMode && previewKeys !== null
      ? (() => {
          const map = new Map<string, T>();
          for (let i = 0; i < keys.length; i += 1) {
            const k = keys[i];
            const it = items[i];
            if (k !== undefined && it !== undefined) map.set(k, it);
          }
          return map;
        })()
      : null;

  // When ghost-mode preview is active, items are rendered in the computed
  // preview order; otherwise they follow the canonical order from props.
  const renderKeys = itemByKey?.size ? (previewKeys ?? keys) : keys;

  return (
    <View className={className}>
      {renderKeys.map((key, renderIdx) => {
        const item = itemByKey?.get(key) ?? items[renderIdx];
        if (item === undefined) return null;

        const isDimmed = isGhostMode ? key === ghostKey : key === draggedKey;
        const showAbove = !isGhostMode && indicatorIndex !== null && indicatorIndex === renderIdx;
        const isLast = renderIdx === renderKeys.length - 1;
        const showBelow = !isGhostMode && isLast && indicatorIndex === renderKeys.length;

        // FLIP offset for this item: moved item uses custom easing, pushed items use linear.
        const initialOffset = itemOffsets?.get(key) ?? 0;
        const progress = key === movedKey ? flipMoved : flipPushed;
        const translateY =
          isFlipping && initialOffset !== 0 ? progress.interpolate({ inputRange: [0, 1], outputRange: [initialOffset, 0] }) : 0;

        const indicatorTestID = testID ? `${testID}-indicator` : undefined;
        const itemTestID = testID ? `${testID}-item-${key}` : undefined;

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
            {showAbove ? <InsertionIndicator position="above" testID={indicatorTestID} /> : null}
            <ReorderableItem
              disabled={disabled}
              itemKey={key}
              listId={listId}
              mimeType={mimeType}
              preview={renderPreview?.(item, renderIdx)}
              testID={itemTestID}
            >
              {renderItem(item, renderIdx, isDimmed)}
            </ReorderableItem>
            {showBelow ? <InsertionIndicator position="below" testID={indicatorTestID} /> : null}
          </Animated.View>
        );
      })}
    </View>
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
  renderPreview,
  keyExtractor,
  mimeType = DEFAULT_MIME,
  ref,
  disabled = false,
  className,
  mode = 'indicator',
  testID,
}: ReorderableListProps<T>) {
  const listId = useId();
  const keys = useMemo(() => items.map((item, index) => keyExtractor(item, index)), [items, keyExtractor]);

  // Create or sync the per-instance Zustand store.
  const store = getOrCreateReorderableListStore(listId, { items, keys, disabled, mode, onReorder });

  // Keep closure-bound config in sync with props on every render.
  // syncConfig is cheap — it assigns closure variables; set({ disabled }) is
  // Object.is-guarded by Zustand and won't trigger listeners when unchanged.
  store.getState().syncConfig({ items, keys, disabled, mode: mode ?? 'indicator', onReorder });

  // Clean up the store from the global registry on unmount.
  useEffect(() => () => removeReorderableListStore(listId), [listId]);

  return (
    <DragManager ref={ref} isolate={true} testID={testID}>
      <ReorderableListView
        className={className}
        disabled={disabled}
        items={items}
        keys={keys}
        listId={listId}
        mimeType={mimeType}
        renderItem={renderItem}
        renderPreview={renderPreview}
        testID={testID}
      />
    </DragManager>
  );
}
