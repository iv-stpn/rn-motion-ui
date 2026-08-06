// The pure half of the group drag: which ids travel, and how they ride along.
//
// Kept free of React and react-native so it is unit-testable — the components
// beside it are not, and this is where the behaviour worth asserting lives.

import type { DragTransfer } from '../drag.types';

/**
 * Where a group drag writes the ids it carries, as a JSON string array.
 *
 * Published rather than private because it is the seam: a `<Dragzone>` reads the
 * group off `transfer.getData(MULTI_DRAG_IDS_MIME)` in its `accepts` and `onDrop`
 * without needing anything from the manager, and the same string crosses a real
 * `DataTransfer` so it survives the HTML5 transport.
 */
export const MULTI_DRAG_IDS_MIME = 'application/x-multi-drag-ids';

/** Writes `ids` onto a transfer under {@link MULTI_DRAG_IDS_MIME}. */
export function writeMultiDragIds(transfer: DragTransfer, ids: readonly string[]): void {
  transfer.setData(MULTI_DRAG_IDS_MIME, JSON.stringify(ids));
}

/**
 * The ids a transfer carries, or `[]` when it carries none.
 *
 * Total on purpose: a transfer from a plain `<Draggable>`, from another app, or
 * from an older build has no such entry, and a drop target reading this should get
 * an empty group rather than an exception.
 */
export function readMultiDragIds(transfer: DragTransfer | null | undefined): string[] {
  if (!transfer) return [];
  const raw = transfer.getData(MULTI_DRAG_IDS_MIME);
  if (raw === '') return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    // Someone else's payload under our MIME, or a truncated string — an empty
    // group is the honest answer and keeps the drop alive.
    return [];
  }
}

/**
 * `data` with the group's ids added under {@link MULTI_DRAG_IDS_MIME}.
 *
 * The manager's own `getGroupData` is left in charge of the payload; this only
 * guarantees the ids are on it, so `readMultiDragIds` works against a transfer whose
 * consumer never agreed on a payload format — including a `drop` listener outside
 * this library. A `getGroupData` that writes this MIME itself wins.
 */
export function withMultiDragIds(data: Record<string, string>, ids: readonly string[]): Record<string, string> {
  return { [MULTI_DRAG_IDS_MIME]: JSON.stringify(ids), ...data };
}

/** Decides which ids a lift of `liftedId` carries, given the current selection. */
export type MultiDragIdResolver = (liftedId: string, selectedIds: ReadonlySet<string>) => string[];

/**
 * The ids a lift carries: the whole selection when the lifted item is part of it,
 * otherwise just the item.
 *
 * This is the rule every file manager and mail client already follows — dragging a
 * selected row takes the selection with it, dragging an unselected one does not —
 * and it is what `resolveIds` defaults to. Order follows `selectedIds` so the
 * payload matches the order the consumer maintains, not the order of the grab.
 */
export const defaultResolveIds: MultiDragIdResolver = (liftedId, selectedIds) => {
  if (selectedIds.size < 2 || !selectedIds.has(liftedId)) return [liftedId];
  return [...selectedIds];
};
