import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DragRect } from '../drag.types';
import {
  beginDrag,
  endDrag,
  getActiveDrag,
  getDragPoint,
  getDragSnapshot,
  getZoneManagerPath,
  getZoneRect,
  getZoneStanding,
  moveDrag,
  registerDragzone,
  resetDragStore,
  shiftZoneRects,
  subscribeDragMove,
  subscribeDragShift,
  subscribeDragStore,
} from '../drag-store';
import { drag, rect, zone } from './drag-harness';
import { addManager, addZone, lift, zoneSpies } from './drag-store-harness';

afterEach(() => {
  resetDragStore();
});

describe('the idle store', () => {
  it('reports no drag, and the same snapshot object every time', () => {
    expect(getActiveDrag()).toBeNull();
    expect(getDragPoint()).toBeNull();
    // Stable identity while nothing changes is what keeps useSyncExternalStore from
    // re-rendering every subscriber on an unrelated commit.
    expect(getDragSnapshot()).toBe(getDragSnapshot());
    expect(getDragSnapshot().drag).toBeNull();
  });

  it('ignores a move or an end with nothing in flight', () => {
    expect(moveDrag({ x: 10, y: 10 })).toBeNull();
    expect(endDrag({ commit: true, point: { x: 10, y: 10 }, sourceId: 'source' })).toEqual({
      canceled: true,
      dropEffect: 'none',
      point: { x: 10, y: 10 },
      zoneId: null,
    });
  });
});

describe('beginDrag', () => {
  it('publishes the drag and the zones that could take it, before any move', async () => {
    await addZone({ id: 'files', groups: ['files'], rect: rect(0, 0, 100, 100) });
    await addZone({ id: 'cards', groups: ['cards'], rect: rect(0, 200, 100, 100) });

    const active = lift({ groups: ['files'] });

    const snapshot = getDragSnapshot();
    expect(snapshot.drag).toBe(active);
    // The affordance appears at lift time, everywhere it could apply — not just
    // under the pointer, which has not moved yet.
    expect(snapshot.eligibleZoneIds).toEqual(['files']);
    expect(snapshot.overZoneId).toBeNull();
    expect(getDragPoint()).toEqual(active.origin.grab);
  });

  it('carries the preview through to the snapshot for a manager to draw', () => {
    const active = drag();
    beginDrag({ drag: active, preview: { hostId: 'board', node: null }, sourceCancel: () => undefined });
    expect(getDragSnapshot().preview).toEqual({ hostId: 'board', node: null });
  });

  it('tells the managers above the source, innermost first', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    const order: string[] = [];
    addManager('page', { onDragStart: () => order.push('page') });
    addManager('board', { onDragStart: () => order.push('board') }, 'page');
    addManager('unrelated', { onDragStart: outer });
    addManager('inner-unused', { onDragStart: inner });

    lift({ managerPath: ['page', 'board'] });

    // Same direction a DOM event bubbles: the board hears about it before the page.
    expect(order).toEqual(['board', 'page']);
    expect(outer).not.toHaveBeenCalled();
    expect(inner).not.toHaveBeenCalled();
  });

  it('wakes store subscribers once', () => {
    const listener = vi.fn();
    subscribeDragStore(listener);
    lift();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('moveDrag', () => {
  it('returns the zone under the pointer and fires enter, then over', async () => {
    const spies = zoneSpies();
    await addZone({ id: 'target', rect: rect(0, 0, 100, 100), ...spies });
    lift();

    expect(moveDrag({ x: 50, y: 50 })).toBe('target');
    expect(spies.onDragEnter).toHaveBeenCalledTimes(1);
    expect(spies.onDragOver).not.toHaveBeenCalled();
    expect(getDragSnapshot().overZoneId).toBe('target');

    expect(moveDrag({ x: 60, y: 60 })).toBe('target');
    expect(spies.onDragEnter).toHaveBeenCalledTimes(1);
    expect(spies.onDragOver).toHaveBeenCalledTimes(1);
  });

  it('does not publish while the pointer travels inside one zone', async () => {
    await addZone({ id: 'target', rect: rect(0, 0, 100, 100) });
    lift();
    moveDrag({ x: 50, y: 50 });

    const listener = vi.fn();
    subscribeDragStore(listener);
    const before = getDragSnapshot();
    moveDrag({ x: 51, y: 51 });
    moveDrag({ x: 52, y: 52 });

    // The whole reason movement has its own channel: a zone re-renders on a
    // crossing, not once a frame.
    expect(listener).not.toHaveBeenCalled();
    expect(getDragSnapshot()).toBe(before);
  });

  it('keeps a zone\u2019s standing object while its own standing is unchanged', async () => {
    await addZone({ id: 'from', groups: ['files'], rect: rect(0, 0, 100, 100) });
    await addZone({ id: 'to', groups: ['files'], rect: rect(200, 0, 100, 100) });
    await addZone({ id: 'unrelated', groups: ['cards'], rect: rect(0, 400, 100, 100) });
    lift({ groups: ['files'] });

    // Lift publishes once: eligible zones get a standing, the ineligible one
    // stays on the shared idle object.
    const fromStanding = getZoneStanding('from');
    expect(fromStanding).toEqual({ drag: expect.anything(), isEligible: true, isOver: false });
    const unrelatedStanding = getZoneStanding('unrelated');
    expect(unrelatedStanding).toEqual({ drag: expect.anything(), isEligible: false, isOver: false });

    // Entering `from` flips its own isOver — a fresh object, so that zone alone
    // re-renders. `unrelated` keeps its object identity through the publish.
    moveDrag({ x: 50, y: 50 });
    expect(getZoneStanding('from')).not.toBe(fromStanding);
    expect(getZoneStanding('from').isOver).toBe(true);
    expect(getZoneStanding('unrelated')).toBe(unrelatedStanding);

    // Movement inside `from` publishes nothing, so no standing moves at all.
    const fromInside = getZoneStanding('from');
    moveDrag({ x: 55, y: 55 });
    expect(getZoneStanding('from')).toBe(fromInside);
    expect(getZoneStanding('unrelated')).toBe(unrelatedStanding);

    // Crossing into `to` flips both zones\u2019 isOver — fresh objects for the two
    // parties — and still leaves the untouched zone on the same reference. This
    // is the contract that keeps a file system\u2019s folder rows from all re-rendering
    // on every boundary the drag crosses.
    moveDrag({ x: 250, y: 50 });
    expect(getZoneStanding('from').isOver).toBe(false);
    expect(getZoneStanding('to').isOver).toBe(true);
    expect(getZoneStanding('from')).not.toBe(fromInside);
    expect(getZoneStanding('unrelated')).toBe(unrelatedStanding);
  });

  it('returns a stable idle standing for an unregistered or drag-free zone', async () => {
    await addZone({ id: 'target', rect: rect(0, 0, 100, 100) });
    // No drag: the standing is the shared all-false object, stable per read.
    expect(getZoneStanding('target')).toEqual({ drag: null, isEligible: false, isOver: false });
    expect(getZoneStanding('target')).toBe(getZoneStanding('target'));
    expect(getZoneStanding('never-registered')).toBe(getZoneStanding('never-registered'));

    lift();
    // Under a drag the registered zone leaves the idle object; the unknown id
    // still reads the shared one.
    expect(getZoneStanding('target')).not.toEqual({ drag: null, isEligible: false, isOver: false });
    expect(getZoneStanding('never-registered')).toEqual({ drag: null, isEligible: false, isOver: false });

    endDrag({ commit: false, point: { x: 0, y: 0 }, sourceId: 'source' });
    expect(getZoneStanding('target')).toEqual({ drag: null, isEligible: false, isOver: false });
  });

  it('fires leave on the zone left behind, before enter on the one arrived at', async () => {
    const from = zoneSpies();
    const to = zoneSpies();
    await addZone({ id: 'from', rect: rect(0, 0, 100, 100), ...from });
    await addZone({ id: 'to', rect: rect(200, 0, 100, 100), ...to });
    lift();

    moveDrag({ x: 50, y: 50 });
    moveDrag({ x: 250, y: 50 });

    expect(from.onDragLeave).toHaveBeenCalledTimes(1);
    expect(to.onDragEnter).toHaveBeenCalledTimes(1);
    expect(from.onDragLeave.mock.invocationCallOrder[0]).toBeLessThan(to.onDragEnter.mock.invocationCallOrder[0] ?? 0);
    expect(getDragSnapshot().overZoneId).toBe('to');
  });

  it('leaves the last zone when the pointer moves onto nothing', async () => {
    const spies = zoneSpies();
    await addZone({ id: 'target', rect: rect(0, 0, 100, 100), ...spies });
    lift();
    moveDrag({ x: 50, y: 50 });
    expect(moveDrag({ x: 500, y: 500 })).toBeNull();
    expect(spies.onDragLeave).toHaveBeenCalledTimes(1);
    expect(getDragSnapshot().overZoneId).toBeNull();
  });

  it('reports the pointer on the move channel, every move', async () => {
    await addZone({ id: 'target', rect: rect(0, 0, 100, 100) });
    lift();
    const listener = vi.fn();
    const unsubscribe = subscribeDragMove(listener);

    moveDrag({ x: 10, y: 10 });
    moveDrag({ x: 11, y: 11 });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith({ x: 11, y: 11 });
    expect(getDragPoint()).toEqual({ x: 11, y: 11 });

    unsubscribe();
    moveDrag({ x: 12, y: 12 });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('tells the managers above the source where the drag is', async () => {
    const onDragMove = vi.fn();
    addManager('board', { onDragMove });
    await addZone({ id: 'target', managerPath: ['board'], rect: rect(0, 0, 100, 100) });
    lift({ managerPath: ['board'] });

    moveDrag({ x: 50, y: 50 });
    expect(onDragMove).toHaveBeenCalledWith(expect.objectContaining({ point: { x: 50, y: 50 }, zoneId: 'target' }));
  });
});

describe('getZoneRect', () => {
  it('returns the measured box of a registered zone', async () => {
    await addZone({ id: 'target', rect: rect(10, 20, 300, 40) });
    expect(getZoneRect('target')).toEqual(rect(10, 20, 300, 40));
  });

  it('returns null for a zone that has not registered, and for one that has not measured', () => {
    expect(getZoneRect('nobody')).toBeNull();
    registerDragzone({
      getConfig: () => zone({ id: 'unmeasured' }).getConfig(),
      id: 'unmeasured',
      managerPath: [],
      measure: () => Promise.resolve(null),
    });
    expect(getZoneRect('unmeasured')).toBeNull();
  });

  it('tracks a re-measure', async () => {
    let box: DragRect | null = rect(0, 0, 100, 100);
    const registration = registerDragzone({
      getConfig: () => zone({ id: 'moved', rect: box }).getConfig(),
      id: 'moved',
      managerPath: [],
      measure: () => Promise.resolve(box),
    });
    expect(getZoneRect('moved')).toBeNull();
    box = rect(50, 50, 200, 200);
    await registration.remeasure();
    expect(getZoneRect('moved')).toEqual(rect(50, 50, 200, 200));
  });

  it('reports the manager path a zone registered under, or null for a stranger', async () => {
    addManager('pane');
    await addZone({ id: 'row', managerPath: ['pane'], rect: rect(0, 0, 10, 10) });
    expect(getZoneManagerPath('row')).toEqual(['pane']);
    expect(getZoneManagerPath('nobody')).toBeNull();
  });
});

describe('shiftZoneRects', () => {
  it('moves the cached rects of zones under the prefix by the scroll delta', async () => {
    await addZone({ id: 'row', managerPath: ['pane'], rect: rect(0, 100, 100, 36) });
    lift();

    // Scrolling down moves the content up in the window: y shrinks, x untouched.
    shiftZoneRects(0, 40, ['pane']);
    expect(getZoneRect('row')).toEqual(rect(0, 60, 100, 36));
    // Scrolling right/up moves the content left/down: x shrinks, y grows.
    shiftZoneRects(10, -20, ['pane']);
    expect(getZoneRect('row')).toEqual(rect(-10, 80, 100, 36));
  });

  it('leaves the zones of another manager on the same page untouched', async () => {
    addManager('pane');
    addManager('other');
    await addZone({ id: 'mine', managerPath: ['pane'], rect: rect(0, 100, 100, 36) });
    await addZone({ id: 'theirs', managerPath: ['other'], rect: rect(0, 100, 100, 36) });
    lift();

    shiftZoneRects(0, 40, ['pane']);
    expect(getZoneRect('mine')).toEqual(rect(0, 60, 100, 36));
    expect(getZoneRect('theirs')).toEqual(rect(0, 100, 100, 36));
  });

  it('skips zones the predicate refuses — the static fallbacks that wrap the scrollable', async () => {
    addManager('pane');
    await addZone({ id: 'row', managerPath: ['pane'], rect: rect(0, 100, 100, 36) });
    await addZone({ id: 'fallback', managerPath: ['pane'], rect: rect(0, 0, 100, 300) });
    lift();

    shiftZoneRects(0, 40, ['pane'], (entry) => entry.id !== 'fallback');
    expect(getZoneRect('row')).toEqual(rect(0, 60, 100, 36));
    expect(getZoneRect('fallback')).toEqual(rect(0, 0, 100, 300));
  });

  it('re-resolves the target at the stationary pointer — a scroll under it is a crossing', async () => {
    const spies = zoneSpies();
    await addZone({ id: 'a', rect: rect(0, 0, 100, 100) });
    await addZone({ id: 'b', rect: rect(0, 100, 100, 100), ...spies });
    lift();
    moveDrag({ x: 50, y: 80 });
    expect(getDragSnapshot().overZoneId).toBe('a');

    // Scroll down 60px with the pointer still: 'a' leaves the pointer and 'b'
    // moves under it, so the winner changes without a single moveDrag.
    shiftZoneRects(0, 60, []);
    expect(getDragSnapshot().overZoneId).toBe('b');
    expect(spies.onDragEnter).toHaveBeenCalledTimes(1);
  });

  it('fires the shift subscribers once per shift, before the re-resolve', async () => {
    const listener = vi.fn();
    subscribeDragShift(listener);
    await addZone({ id: 'a', rect: rect(0, 0, 100, 100) });
    lift();

    shiftZoneRects(0, 10, []);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('is a no-op without a drag, or with a zero delta', async () => {
    await addZone({ id: 'a', rect: rect(0, 0, 100, 100) });
    const listener = vi.fn();
    subscribeDragShift(listener);

    shiftZoneRects(0, 10, []);
    expect(listener).not.toHaveBeenCalled();
    expect(getZoneRect('a')).toEqual(rect(0, 0, 100, 100));

    lift();
    shiftZoneRects(0, 0, []);
    expect(listener).not.toHaveBeenCalled();
    expect(getZoneRect('a')).toEqual(rect(0, 0, 100, 100));
  });
});
