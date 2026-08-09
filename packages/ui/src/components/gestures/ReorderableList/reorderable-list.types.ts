// Public types for the ReorderableList component.
//
// Kept in its own module so the pure reorder logic in `reorderable-list-reorder.ts` can import
// only the geometry types from `../drag.types` without pulling in the component
// types — and so a consumer importing the component does not transitively import
// the reorder math.

import type { ReactNode, Ref } from 'react';
import type { DragManagerHandle } from '../drag.types';

/**
 * Props for the `<ReorderableList>` component.
 *
 * ```tsx
 * <ReorderableList
 *   items={todos}
 *   onReorder={(items, from, to) => updateOrder(items)}
 *   renderItem={(todo, _index, isDragging) => (
 *     <View className={isDragging ? 'opacity-40' : ''}>
 *       <Text>{todo.title}</Text>
 *     </View>
 *   )}
 *   keyExtractor={(todo) => todo.id}
 * />
 * ```
 */
export type ReorderableListProps<T> = {
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
   * Renders one item. Receives the item, its visual index, and whether it is
   * the one currently being dragged — the flag to dim it at its source position.
   *
   * In `'ghost'` mode, `isDragging` is also `true` for the ghost placeholder
   * rendered at the dragged item's position in the preview order.
   *
   * The returned node is wrapped in the drag source and drop target, so it
   * needs no drag props of its own.
   */
  renderItem: (item: T, index: number, isDragging: boolean) => ReactNode;
  /** Stable unique key per item. Used as the drag payload and for React keys. */
  keyExtractor: (item: T, index: number) => string;
  /**
   * Optional custom ghost content for the dragged item. When set, the
   * floating drag preview uses this node instead of the rendered item.
   *
   * Useful in `'ghost'` mode to make the flying copy visually distinct —
   * for example, a rounded card version of a grouped row.
   */
  renderPreview?: (item: T, index: number) => ReactNode;
  /**
   * How the list communicates the landing spot during a drag.
   *
   * - `'indicator'` (default) — an insertion line floats at the projected
   *   landing spot. Items stay in place until drop, then animate with FLIP.
   * - `'ghost'` — items visually reorder in real-time during the drag. The
   *   dragged item is dimmed at its preview position (passed to `renderItem`
   *   as `isDragging: true`). No insertion indicator is shown. The reorder
   *   commits on drop; cancelling reverts to the original order.
   *
   * @default 'indicator'
   */
  mode?: 'indicator' | 'ghost';
  /**
   * The MIME type written to the drag transfer for each item.
   * @default 'application/x-reorderable-item'
   */
  mimeType?: string;
  /** Ref to the underlying `<DragManager>`. */
  ref?: Ref<DragManagerHandle>;
  /** When true, no item in the list can be dragged. @default false */
  disabled?: boolean;
  /**
   * Optional className applied to the list container.
   *
   * Useful for adding spacing between items (e.g. `gap-2`) without needing a
   * wrapper View.
   */
  className?: string;
  /**
   * Prefix for test IDs. Items derive `${testID}-item-<key>`; the insertion
   * indicator is `${testID}-indicator`.
   */
  testID?: string;
};
