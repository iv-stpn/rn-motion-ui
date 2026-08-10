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

import { type ReactNode, useCallback, useRef } from 'react';
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Draggable } from '../Draggable/draggable';
import { Dragzone } from '../Dragzone/dragzone';
import type { DragEndEvent, DragMoveEvent, DragzoneAcceptEvent, DragzoneHandle } from '../drag.types';
import { useSortableList } from './sortable-list';

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

  const { activeIndexSV, dropVersionSV, insertionIndexSV, itemHeight, onDragEnd, onDragMove, onDragStart } = useSortableList();

  // ── Reanimated-driven position ──────────────────────────────────────────
  // translateY is driven entirely on the UI thread via useAnimatedReaction,
  // which watches the shared values for activeIndex and insertionIndex.
  // This eliminates per-frame JS bridge hops and React re-renders during the
  // drag — only the commit (onDrop) crosses back to JS.
  const translateY = useSharedValue(0);
  const lastDropVersion = useSharedValue(0);

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
