import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  beginDrag,
  endDrag,
  getActiveDrag,
  getDragPoint,
  getDragSnapshot,
  moveDrag,
  resetDragStore,
  subscribeDragMove,
  subscribeDragStore,
} from '../drag-store';
import { drag, rect } from './drag-harness';
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
