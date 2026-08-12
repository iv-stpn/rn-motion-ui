// A single reorderable item inside a `<ReorderableList>`.
//
// Thin on purpose: a `<Dragzone>` wrapping a `<Draggable>`, plus the callbacks
// that wire the two into the list's state. State and actions are read from the
// list's Zustand store (looked up by `listId`) so the item doesn't need to
// receive callbacks as props — just `listId` and `itemKey`.
//
// Internal to `ReorderableList`; not exported from the package.

import { type ReactNode, useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { cn } from '../../../lib/cn';
import { Draggable } from '../Draggable/draggable';
import { Dragzone } from '../Dragzone/dragzone';
import type { DragzoneAcceptEvent, DragzoneDragEvent, DragzoneDropEvent, DragzoneHandle } from '../drag.types';
import { useReorderableListStore } from './reorderable-list.store';

export type ReorderableItemProps = {
  children: ReactNode;
  /** Unique key for this item, from the consumer's `keyExtractor`. */
  itemKey: string;
  /** The list ID — used to look up the Zustand store and as the drag group. */
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
 * One row in a reorderable list — a drop target that can also be picked up.
 *
 * Renders `<Dragzone>` around `<Draggable>` so the full item area is both the
 * source and the target. The Dragzone's `accepts` rejects the item's own key
 * so a self-drop is always a no-op.
 */
export function ReorderableItem({
  children,
  itemKey,
  listId,
  mimeType,
  disabled = false,
  preview,
  testID,
}: ReorderableItemProps) {
  const zoneRef = useRef<DragzoneHandle>(null);

  // ── Read actions from the list's Zustand store ─────────────────────────
  const onLift = useReorderableListStore(listId, (s) => s.onLift);
  const onOver = useReorderableListStore(listId, (s) => s.onOver);
  const onLeave = useReorderableListStore(listId, (s) => s.onLeave);
  const onDrop = useReorderableListStore(listId, (s) => s.onDrop);
  const onDragEnd = useReorderableListStore(listId, (s) => s.onDragEnd);
  const onMeasure = useReorderableListStore(listId, (s) => s.onMeasure);
  const draggedKey = useReorderableListStore(listId, (s) => s.draggedKey);

  // ── Callback wiring — bind itemKey to store actions ───────────────────
  const handleDragStart = useCallback(() => {
    onLift(itemKey);
  }, [itemKey, onLift]);

  const handleDragOver = useCallback(
    (event: DragzoneDragEvent) => {
      onOver(itemKey, event.point);
    },
    [itemKey, onOver],
  );

  const handleDragEnter = useCallback(
    (event: DragzoneDragEvent) => {
      onOver(itemKey, event.point);
    },
    [itemKey, onOver],
  );

  const handleDragLeave = useCallback(() => {
    onLeave(itemKey);
  }, [itemKey, onLeave]);

  const handleDrop = useCallback(
    (event: DragzoneDropEvent) => {
      onDrop(itemKey, event.point);
    },
    [itemKey, onDrop],
  );

  const handleDragEnd = useCallback(() => {
    onDragEnd(itemKey);
  }, [itemKey, onDragEnd]);

  const handleLayout = useCallback(() => {
    zoneRef.current
      ?.measure()
      .then((rect) => {
        if (rect) onMeasure(itemKey, rect);
      })
      .catch(() => undefined);
  }, [itemKey, onMeasure]);

  // Mirror Dragzone's own useEffect: `onLayout` does not fire reliably in the test
  // environment (JSDOM), so measure the zone on mount to populate `_rects` before a
  // drag can land here. The `measure()` resolves on a timer — `liftDrag`'s
  // `await settle()` drains that timer, keeping the test deterministic.
  // biome-ignore lint/plugin: measuring a Dragzone on mount; same pattern Dragzone uses for its own registration
  useEffect(() => {
    zoneRef.current
      ?.measure()
      .then((rect) => {
        if (rect) onMeasure(itemKey, rect);
      })
      .catch(() => undefined);
  }, [itemKey, onMeasure]);

  // The drag store's `beginDrag` calls `measureZones()` which refreshes every
  // zone's `entry.rect` — but the list store's `_rects` is only populated at
  // mount and layout.  When they disagree, `insertionPosition` computes the wrong
  // `before` value and the drop lands one slot early.  Re-measuring every item
  // when a drag starts keeps `_rects` in sync with the zones' rects for the
  // duration of the drag.
  // biome-ignore lint/plugin: re-measuring a Dragzone when a drag starts; same async-timer pattern as the mount measure above
  useEffect(() => {
    if (draggedKey === null) return;
    zoneRef.current
      ?.measure()
      .then((rect) => {
        if (rect) onMeasure(itemKey, rect);
      })
      .catch(() => undefined);
  }, [draggedKey, itemKey, onMeasure]);

  // Reject self-drops: the dragged item's key is in the transfer.
  // Guard `drag === null` first — an external payload has no in-library source
  // and should never land on a list item.
  const accepts = useCallback(
    (event: DragzoneAcceptEvent) => {
      if (disabled || event.drag === null) return false;
      return event.transfer.getData(mimeType) !== itemKey;
    },
    [disabled, itemKey, mimeType],
  );

  const webHover = Platform.OS === 'web' && !disabled;

  return (
    <Dragzone
      ref={zoneRef}
      accepts={accepts}
      className={cn(webHover && 'transition-all duration-200 hover:bg-surface-hover')}
      disabled={disabled}
      groups={[listId]}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onLayout={handleLayout}
    >
      <Draggable
        className={cn(webHover && 'cursor-grab')}
        data={{ [mimeType]: itemKey }}
        disabled={disabled}
        groups={[listId]}
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
        preview={preview}
        testID={testID}
      >
        {children}
      </Draggable>
    </Dragzone>
  );
}
