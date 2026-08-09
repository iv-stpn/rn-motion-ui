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

import { type ReactNode, useEffect, useId, useMemo } from 'react';
import { View } from 'react-native';
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
  testID,
}: ReorderableListViewProps<T>) {
  // ── Read from the list's Zustand store ────────────────────────────────
  const draggedKey = useReorderableListStore(listId, (s) => s.draggedKey);
  const indicatorIndex = useReorderableListStore(listId, (s) => s.indicatorIndex);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
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

  // Create or sync the per-instance Zustand store.
  const store = getOrCreateReorderableListStore(listId, { items, keys, disabled, onReorder });

  // Keep closure-bound config in sync with props on every render.
  // syncConfig is cheap — it assigns closure variables; set({ disabled }) is
  // Object.is-guarded by Zustand and won't trigger listeners when unchanged.
  store.getState().syncConfig({ items, keys, disabled, onReorder });

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
        testID={testID}
      />
    </DragManager>
  );
}
