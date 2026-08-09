// A single sortable item inside a <SortableList>.
//
// Each item is both a drag source and a drop target — a <Dragzone> wrapping a
// <Draggable>. The zone's `accepts` rejects the item's own key so a self-drop
// is always a no-op.
//
// Position animation: the item reads `activeIndex` and `insertionIndex` from
// the list context, computes its visual target index via `computeTargetIndex`,
// and animates its `translateY` to `(targetIndex - ownIndex) * itemHeight`
// using Animated.timing. Items always render in canonical order; only their
// transforms change — which is what keeps the tree stable and eliminates the
// measurement feedback loop the old ghost mode suffered from.
//
// Internal to SortableList; not exported from the package.

import { type ReactNode, useCallback, useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Draggable } from '../Draggable/draggable';
import { Dragzone } from '../Dragzone/dragzone';
import type { DragEndEvent, DragMoveEvent, DragzoneAcceptEvent, DragzoneHandle } from '../drag.types';
import { useSortableList } from './sortable-list';

export type SortableItemProps = {
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
export function computeTargetIndex(ownIndex: number, activeIndex: number, insertionIndex: number): number {
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
export function SortableItem({
  children,
  itemKey,
  index,
  listId,
  mimeType,
  disabled = false,
  preview,
  testID,
}: SortableItemProps) {
  const zoneRef = useRef<DragzoneHandle>(null);
  const translateY = useRef(new Animated.Value(0)).current;

  const { activeIndex, dropVersion, insertionIndex, itemHeight, onDragEnd, onDragMove, onDragStart } = useSortableList();

  const targetIndex =
    activeIndex !== -1 && insertionIndex !== null ? computeTargetIndex(index, activeIndex, insertionIndex) : index;
  const targetTranslateY = (targetIndex - index) * itemHeight;

  // Track the drop version so we can snap instead of animate when the reorder
  // commits. During the drag every item is already at its visual position — on
  // commit the canonical order changes and transform should jump to 0 instantly
  // rather than sliding from the drag-time offset.
  const lastDropVersion = useRef(dropVersion);

  // Animate translateY to the target whenever the visual position changes.
  useEffect(() => {
    const snap = dropVersion !== lastDropVersion.current;
    lastDropVersion.current = dropVersion;

    if (snap) {
      translateY.setValue(targetTranslateY);
    } else {
      Animated.timing(translateY, {
        toValue: targetTranslateY,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [targetTranslateY, translateY, dropVersion]);

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

  // Measure the zone on mount so the store knows its rect before a drag can land
  // here. Mirror of the pattern in ReorderableItem and Dragzone itself.
  useEffect(() => {
    zoneRef.current?.measure().catch(() => undefined);
  }, []);

  return (
    <Animated.View style={{ height: itemHeight, transform: [{ translateY }] }}>
      <Dragzone ref={zoneRef} accepts={accepts} disabled={disabled} groups={[listId]}>
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
