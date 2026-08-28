// What a publish is allowed to wake, and what it must leave alone.
//
// The store fans one drag out to three kinds of subscriber, and the cost of a drag
// is decided almost entirely by how well those three stay in their lanes. A drag
// sweeping across a folder list crosses a zone boundary every few pixels, and every
// crossing runs a publish; if a publish wakes more than the handful of subscribers
// whose own state moved, the cost of a crossing scales with how much is mounted
// rather than with what changed. That is precisely the regression these pin down —
// it is invisible in behaviour and only shows up as lag, so nothing else catches it.
//
// The three lanes:
//   • the snapshot channel — the crossing itself (`overZoneId`), for the leaves that
//     paint it;
//   • the lifecycle channel — the drag starting and ending, and nothing else;
//   • the per-zone channels — one zone's own standing, for that zone alone.

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  endDrag,
  getDragSnapshot,
  moveDrag,
  refreshDragzones,
  resetDragStore,
  subscribeActiveDrag,
  subscribeDragStore,
  subscribeZoneStanding,
} from '../drag-store';
import { rect } from './drag-harness';
import { addZone, lift } from './drag-store-harness';

afterEach(() => {
  resetDragStore();
});

/** Two zones side by side, with a drag in flight over neither of them yet. */
async function twoZones() {
  await addZone({ id: 'left', rect: rect(0, 0, 100, 100) });
  await addZone({ id: 'right', rect: rect(100, 0, 100, 100) });
  return lift({ origin: { grab: { x: 500, y: 500 }, rect: null } });
}

describe('the snapshot channel', () => {
  it('keeps the same snapshot object across a publish that changes nothing', async () => {
    await twoZones();
    const before = getDragSnapshot();
    // Re-measuring re-resolves and re-publishes, but every zone is where it was, so
    // nothing render-visible moved.
    await refreshDragzones();
    // `DragSnapshot` documents this identity contract; a fresh object here means
    // every consumer of the coarse channel re-renders for nothing.
    expect(getDragSnapshot()).toBe(before);
  });

  it('does not notify when a publish changes nothing', async () => {
    await twoZones();
    const listener = vi.fn();
    subscribeDragStore(listener);
    await refreshDragzones();
    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies on a crossing, which is what it is for', async () => {
    await twoZones();
    const listener = vi.fn();
    subscribeDragStore(listener);
    moveDrag({ x: 50, y: 50 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getDragSnapshot().overZoneId).toBe('left');
  });

  it('does not notify while the pointer travels inside one zone', async () => {
    await twoZones();
    moveDrag({ x: 20, y: 20 });
    const listener = vi.fn();
    subscribeDragStore(listener);
    moveDrag({ x: 30, y: 30 });
    moveDrag({ x: 40, y: 40 });
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('the lifecycle channel', () => {
  it('fires once at the lift and once at the release, and not on crossings', async () => {
    await addZone({ id: 'left', rect: rect(0, 0, 100, 100) });
    await addZone({ id: 'right', rect: rect(100, 0, 100, 100) });
    const listener = vi.fn();
    subscribeActiveDrag(listener);

    const active = lift({ origin: { grab: { x: 500, y: 500 }, rect: null } });
    expect(listener).toHaveBeenCalledTimes(1);

    // Four crossings: outside → left → right → left → right.
    moveDrag({ x: 50, y: 50 });
    moveDrag({ x: 150, y: 50 });
    moveDrag({ x: 50, y: 50 });
    moveDrag({ x: 150, y: 50 });
    // The whole point: sweeping a drag across folders must not re-render the views
    // that only asked whether a drag is happening.
    expect(listener).toHaveBeenCalledTimes(1);

    endDrag({ commit: false, point: { x: 150, y: 50 }, sourceId: active.id });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('the per-zone channels', () => {
  it('wakes only the two zones a crossing is a party to', async () => {
    await addZone({ id: 'left', rect: rect(0, 0, 100, 100) });
    await addZone({ id: 'right', rect: rect(100, 0, 100, 100) });
    // A third zone nowhere near the pointer — the stand-in for the other 200 rows
    // of a folder list, every one of which used to be woken by every crossing.
    await addZone({ id: 'far', rect: rect(0, 900, 100, 100) });
    lift({ origin: { grab: { x: 500, y: 500 }, rect: null } });

    const left = vi.fn();
    const right = vi.fn();
    const far = vi.fn();
    subscribeZoneStanding('left', left);
    subscribeZoneStanding('right', right);
    subscribeZoneStanding('far', far);

    moveDrag({ x: 50, y: 50 }); // enter left
    expect(left).toHaveBeenCalledTimes(1);
    expect(right).not.toHaveBeenCalled();
    expect(far).not.toHaveBeenCalled();

    moveDrag({ x: 150, y: 50 }); // left → right
    expect(left).toHaveBeenCalledTimes(2);
    expect(right).toHaveBeenCalledTimes(1);
    // The zone that was never involved is never called at all — not called and
    // bailing out, but not called.
    expect(far).not.toHaveBeenCalled();
  });

  it('stops waking a zone once it unsubscribes', async () => {
    await addZone({ id: 'left', rect: rect(0, 0, 100, 100) });
    lift({ origin: { grab: { x: 500, y: 500 }, rect: null } });
    const listener = vi.fn();
    const unsubscribe = subscribeZoneStanding('left', listener);
    unsubscribe();
    moveDrag({ x: 50, y: 50 });
    expect(listener).not.toHaveBeenCalled();
  });

  it('is inert for an id that never registers', async () => {
    await addZone({ id: 'left', rect: rect(0, 0, 100, 100) });
    lift({ origin: { grab: { x: 500, y: 500 }, rect: null } });
    const listener = vi.fn();
    // A consumer that subscribes before its zone's id is known passes `''`; it must
    // read idle forever rather than throw or be woken by someone else's crossing.
    subscribeZoneStanding('', listener);
    moveDrag({ x: 50, y: 50 });
    expect(listener).not.toHaveBeenCalled();
  });
});
