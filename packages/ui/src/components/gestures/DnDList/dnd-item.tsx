// A single reorderable item inside a `<DnDList>`.
//
// Thin on purpose: a `<Dragzone>` wrapping a `<Draggable>`, plus the callbacks
// that wire the two into the list's state. The drag store already handles hit
// testing, zone crossing, and the ghost — this component just tells the list what
// happened and lets it decide what to do about it.
//
// Internal to `DnDList`; not exported from the package.

import { type ReactNode, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { cn } from '../../../lib/cn';
import { Draggable } from '../Draggable/draggable';
import { Dragzone } from '../Dragzone/dragzone';
import type {
  DragPoint,
  DragRect,
  DragTransfer,
  DragzoneAcceptEvent,
  DragzoneDragEvent,
  DragzoneDropEvent,
  DragzoneHandle,
} from '../drag.types';

export type DnDItemProps = {
  children: ReactNode;
  /** Unique key for this item, from the consumer's `keyExtractor`. */
  itemKey: string;
  /** The list group — all items and zones in one list share this. */
  listGroup: string;
  /** MIME type written to the drag transfer. */
  mimeType: string;
  /** When true, this item is neither draggable nor a drop target. */
  disabled?: boolean;
  /** Called when a drag lifts from this item. */
  onLift: (key: string) => void;
  /**
   * Called on every `onDragOver` while a drag is over this item's zone.
   * Carries the pointer position so the list can decide before/after.
   */
  onOver: (key: string, point: DragPoint) => void;
  /** Called when a drag leaves this item's zone. */
  onLeave: (key: string) => void;
  /** Called when a drag is dropped on this item's zone. Carries the release point and transfer. */
  onDrop: (key: string, point: DragPoint, transfer: DragTransfer) => void;
  /** Called when a drag from this item ends, dropped or not. */
  onDragEnd: (key: string) => void;
  /** Reports this item's measured window rect to the list. */
  onMeasure: (key: string, rect: DragRect) => void;
  /** Applied while a drag this zone would take is in flight, anywhere in the list. */
  eligibleClassName?: string;
  /** Applied while the pointer is over this item during a drag. */
  overClassName?: string;
  testID?: string;
};

/**
 * One row in a DnD list — a drop target that can also be picked up.
 *
 * Renders `<Dragzone>` around `<Draggable>` so the full item area is both the
 * source and the target. The Dragzone's `accepts` rejects the item's own key
 * so a self-drop is always a no-op.
 */
export function DnDItem({
  children,
  itemKey,
  listGroup,
  mimeType,
  disabled = false,
  eligibleClassName,
  overClassName,
  onLift,
  onOver,
  onLeave,
  onDrop,
  onDragEnd,
  onMeasure,
  testID,
}: DnDItemProps) {
  const zoneRef = useRef<DragzoneHandle>(null);

  const handleDragStart = useCallback(() => {
    onLift(itemKey);
  }, [itemKey, onLift]);

  const handleDragOver = useCallback(
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
      onDrop(itemKey, event.point, event.transfer);
    },
    [itemKey, onDrop],
  );

  const handleDragEnd = useCallback(() => {
    onDragEnd(itemKey);
  }, [itemKey, onDragEnd]);

  const handleLayout = useCallback(() => {
    zoneRef.current?.measure().then((rect) => {
      if (rect) onMeasure(itemKey, rect);
    });
  }, [itemKey, onMeasure]);

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
      className={cn(webHover && 'transition-colors hover:bg-surface-hover')}
      disabled={disabled}
      eligibleClassName={eligibleClassName}
      groups={[listGroup]}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onLayout={handleLayout}
      overClassName={overClassName}
      testID={testID}
    >
      <Draggable
        className={cn(webHover && 'cursor-grab')}
        data={{ [mimeType]: itemKey }}
        disabled={disabled}
        groups={[listGroup]}
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
        testID={testID}
      >
        {children}
      </Draggable>
    </Dragzone>
  );
}
