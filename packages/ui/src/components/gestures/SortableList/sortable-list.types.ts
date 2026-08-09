// Public types for the SortableList component.
//
// A SortableList renders items that visually reorder in real-time during a drag.
// The dragged item is dimmed at its preview position; other items smoothly animate
// to their new slots. The reorder commits on drop; cancelling reverts.
//
// Built on the existing gesture primitives — <Draggable>, <Dragzone> and
// <DragManager> — so it inherits their transport story and isolation model.

import type { ReactNode, Ref } from 'react';
import type { DragManagerHandle } from '../drag.types';

/**
 * Props for the `<SortableList>` component.
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
 */
export type SortableListProps<T> = {
  /** The ordered items. Identity of the array signals an external order change. */
  items: readonly T[];
  /**
   * Called when a drag-drop reorder is committed.
   *
   * Receives the new array (so the consumer can replace state in one call),
   * plus the from/to indices for consumers that need to know which item moved.
   */
  onReorder: (items: T[], fromIndex: number, toIndex: number) => void;
  /**
   * Renders one item. Receives the item, its canonical index, and whether it is
   * the one currently being dragged — the flag to dim it at its preview position.
   *
   * The returned node is wrapped in the drag source and drop target, so it
   * needs no drag props of its own.
   */
  renderItem: (item: T, index: number, isDragging: boolean) => ReactNode;
  /** Stable unique key per item. Used as the drag payload and for React keys. */
  keyExtractor: (item: T, index: number) => string;
  /**
   * Fixed height of every item in pixels. **Enforced** — each item's Animated.View
   * wrapper receives `height: itemHeight`, so content taller than this value is
   * clipped and shorter content gets empty space.
   *
   * Required because the insertion-index calculation uses the finger's vertical
   * translation directly — `Math.round(translation.y / itemHeight)` — without
   * measuring rects. All items in the list must share the same height.
   *
   * When using CSS `gap` on the list container, include the gap size in this value
   * so the effective slot spacing matches: `itemHeight = contentHeight + gap`.
   */
  itemHeight: number;
  /**
   * Optional custom ghost content for the dragged item. When set, the
   * floating drag preview uses this node instead of the rendered item.
   *
   * Useful for making the flying copy visually distinct — for example, a
   * rounded card version of a grouped row.
   */
  renderPreview?: (item: T, index: number) => ReactNode;
  /**
   * The MIME type written to the drag transfer for each item.
   * @default 'application/x-sortable-item'
   */
  mimeType?: string;
  /** Ref to the underlying `<DragManager>`. */
  ref?: Ref<DragManagerHandle>;
  /** When true, no item in the list can be dragged. @default false */
  disabled?: boolean;
  /**
   * Optional className applied to the list container.
   *
   * Prefer padding or margin inside each item over CSS `gap` on the container.
   * When a `gap` class is used, the extra spacing is NOT accounted for in the
   * position math — include it in {@link itemHeight} so slots stay aligned.
   */
  className?: string;
  /**
   * Prefix for test IDs. Items derive `${testID}-item-<key>`.
   */
  testID?: string;
};
