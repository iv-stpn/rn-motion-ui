// The payload half of the drag system, with no react-native import anywhere in
// its graph — which is the only reason it can be unit-tested (see the note in
// vitest's setup: anything reaching react-native dies on its Flow source).
//
// What lives here is the native stand-in for the DOM `DataTransfer`, plus the
// group matching every source/zone pairing is decided by. The registry that
// replaces the OS drag session moved to `drag-store.ts`.

import type { DragDropEffect, DragEffectAllowed, DragGroups, DragTransfer } from './drag.types';

/**
 * A `DragTransfer` backed by a Map — what a pan-driven drag carries in place of
 * the browser's `DataTransfer`. The HTML5 transport never calls this: a real drag
 * event already hands over the genuine article, which satisfies the same type.
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
 * transports do exactly this at lift time and the DOM `DataTransfer` takes the
 * same calls — one loop, no platform branch.
 */
export function writeTransferData(transfer: DragTransfer, data: Record<string, string> | undefined): void {
  if (!data) return;
  for (const [format, value] of Object.entries(data)) transfer.setData(format, value);
}

/**
 * A readable view of the browser's `DataTransfer`, for the length of an HTML5 drag.
 *
 * The DOM drag data store is *protected* on every event between `dragstart` and the
 * `drop`: `types` still lists the formats, but `getData` is specified to return `''`
 * — a privacy rule, so a page cannot read what is merely being dragged across it.
 * It applies to the source's own listeners too, `dragend` included.
 *
 * Which is a problem for a system that hit-tests on `drag`, asks each zone's
 * `accepts` for a verdict on the payload, and resolves the drop from the store
 * rather than from the DOM event: all three read the transfer on protected events.
 * Worse, a constructed `new DataTransfer()` in a test is *not* protected, so the
 * whole class of bug is invisible until it reaches a browser.
 *
 * So the payload is snapshotted here at lift time, while the store is still
 * read/write, and every later read is answered from the snapshot. Writes go to both,
 * so a format added mid-drag still crosses to whatever the browser hands the drop
 * to. `dropEffect` is owned here *and* forwarded: the zone's claim has to be
 * readable by the consumer whose `onDrop` runs before the release, and has to reach
 * the browser, which is what `dragend` reports back.
 */
export function mirrorDragTransfer(transfer: DragTransfer, data: Record<string, string> | undefined): DragTransfer {
  const snapshot = new Map<string, string>();
  // Both sources, because neither is sufficient alone: `types` carries formats the
  // page set before this library saw the drag, and `data` is readable even if the
  // engine were to protect the store on `dragstart` as well.
  for (const format of transfer.types) snapshot.set(format, transfer.getData(format));
  if (data) for (const [format, value] of Object.entries(data)) snapshot.set(format, value);
  let dropEffect: DragDropEffect = transfer.dropEffect;

  return {
    get dropEffect() {
      return dropEffect;
    },
    set dropEffect(next: DragDropEffect) {
      dropEffect = next;
      transfer.dropEffect = next;
    },
    get effectAllowed() {
      return transfer.effectAllowed;
    },
    set effectAllowed(next: DragEffectAllowed) {
      transfer.effectAllowed = next;
    },
    getData: (format) => snapshot.get(format) ?? '',
    setData: (format, value) => {
      snapshot.set(format, value);
      transfer.setData(format, value);
    },
    // Fresh array per read, as `createDragTransfer` does: `types` is readonly to a
    // consumer, and the live key iterator would be a way around that.
    get types() {
      return [...snapshot.keys()];
    },
  };
}

/**
 * Whether a source and a zone may interact.
 *
 * An empty list on either side is a wildcard, so a system that never mentions
 * groups works with no configuration at all — the common case, and the one that
 * should need no ceremony. Once *both* sides name groups, they have to overlap:
 * that is what keeps a palette's chips out of a trash can meant for cards.
 */
export function dragGroupsMatch(source: DragGroups, zone: DragGroups): boolean {
  if (source.length === 0 || zone.length === 0) return true;
  return source.some((group) => zone.includes(group));
}
