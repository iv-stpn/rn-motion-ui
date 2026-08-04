// The payload half of <Draggable>, with no react-native import anywhere in its
// graph — which is the only reason it can be unit-tested (see the note in
// vitest's setup: anything reaching react-native dies on its Flow source).
//
// Two things live here: the native stand-in for the DOM `DataTransfer`, and the
// tree-wide record of the drag in flight that replaces the OS drag session
// native does not have.

import type { ActiveDrag, DragDropEffect, DragEffectAllowed, DragTransfer } from './draggable.types';

/**
 * The drag in flight, or null. Module-level rather than a context because a drop
 * zone is not necessarily under the same provider as its source — often not even
 * in the same subtree — and there is only ever one drag, so a second one would
 * be a bug rather than a case to support.
 */
let activeDrag: ActiveDrag | null = null;

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

/**
 * A `DragTransfer` backed by a Map — what a native drag carries in place of the
 * browser's `DataTransfer`. Web never calls this: a real drag event already
 * hands over the genuine article, which satisfies the same type.
 */
export function createDragTransfer(effectAllowed: DragEffectAllowed = 'all'): DragTransfer {
  const data = new Map<string, string>();
  let dropEffect: DragDropEffect = 'none';
  return {
    get dropEffect() {
      return dropEffect;
    },
    set dropEffect(next: DragDropEffect) {
      dropEffect = next;
    },
    effectAllowed,
    getData: (format) => data.get(format) ?? '',
    setData: (format, value) => {
      data.set(format, value);
    },
    // Fresh array per read: `types` is readonly to a consumer, and handing out
    // the live key iterator would let one mutate the transfer through it.
    get types() {
      return [...data.keys()];
    },
  };
}

/**
 * Write a `{ [mime]: string }` record into a transfer. Split out because both
 * platforms do exactly this at lift time and the DOM `DataTransfer` takes the
 * same calls — one loop, no platform branch.
 */
export function writeTransferData(transfer: DragTransfer, data: Record<string, string> | undefined): void {
  if (!data) return;
  for (const [format, value] of Object.entries(data)) transfer.setData(format, value);
}

/** Publish the drag in flight and wake every subscriber. */
export function setActiveDrag(next: ActiveDrag): void {
  activeDrag = next;
  notify();
}

/**
 * Clear the drag in flight, but only if `id` is the one that published it.
 * Unconditional clearing would let a `Draggable` unmounting mid-drag — or one
 * whose gesture was cancelled late — wipe a drag that another source had already
 * started, leaving a drop zone reading `null` while a drag is plainly in progress.
 */
export function clearActiveDrag(id: string): void {
  if (activeDrag?.id !== id) return;
  activeDrag = null;
  notify();
}

/** The drag in flight, or null. Read it in a drop handler to see what is coming. */
export function getActiveDrag(): ActiveDrag | null {
  return activeDrag;
}

/**
 * Subscribe to drag start/end. Deliberately not fired per pointer move — the
 * position travels through `onDragMove`, so a drop zone re-renders twice per
 * drag rather than once per frame.
 */
export function subscribeActiveDrag(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
