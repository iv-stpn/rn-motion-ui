// The end of a drag: what a release resolves to, who hears about it, and the
// external path that has no session behind it at all.
//
// Split from `drag-store.test.ts` only for length; both drive the same module
// state and reset it the same way.

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cancelActiveDrag,
  canZoneAcceptExternal,
  deliverExternalDrop,
  endDrag,
  getActiveDrag,
  getDragSnapshot,
  moveDrag,
  resetDragStore,
} from '../drag-store';
import { createDragTransfer } from '../drag-transfer';
import { rect } from './drag-harness';
import { addManager, addZone, lift, zoneSpies } from './drag-store-harness';

const AT = { x: 50, y: 50 };
const OUTSIDE = { x: 900, y: 900 };

afterEach(() => {
  resetDragStore();
});

describe('endDrag', () => {
  it('drops on the zone under the release point and reports its effect', async () => {
    const spies = zoneSpies();
    await addZone({ id: 'target', dropEffect: 'move', rect: rect(0, 0, 100, 100), ...spies });
    const active = lift();
    moveDrag(AT);

    const outcome = endDrag({ commit: true, point: AT, sourceId: active.id });

    expect(outcome).toEqual({ canceled: false, dropEffect: 'move', point: AT, zoneId: 'target' });
    expect(spies.onDrop).toHaveBeenCalledTimes(1);
    expect(spies.onDrop).toHaveBeenCalledWith(
      expect.objectContaining({ drag: active, external: false, files: [], zoneId: 'target' }),
    );
    // The zone's claim is written onto the payload, so a source reading its own
    // transfer afterwards sees what became of it.
    expect(active.transfer.dropEffect).toBe('move');
  });

  it('resolves the target at the release point, not from the last move', async () => {
    await addZone({ id: 'from', rect: rect(0, 0, 100, 100) });
    await addZone({ id: 'to', rect: rect(200, 0, 100, 100) });
    const active = lift();
    moveDrag(AT);

    // A release can land somewhere the last move never reported — a fast flick, or
    // a platform that coalesces the final move into the release.
    expect(endDrag({ commit: true, point: { x: 250, y: 50 }, sourceId: active.id }).zoneId).toBe('to');
  });

  it('cancels when the release lands on nothing', async () => {
    await addZone({ id: 'target', rect: rect(0, 0, 100, 100) });
    const active = lift();
    moveDrag(AT);

    // A real browser fires drag events as the cursor travels from the zone to
    // the release point; the last one updates session.point so the fallback in
    // endDrag sees the same outside location and finds nothing.
    moveDrag(OUTSIDE);

    const outcome = endDrag({ commit: true, point: OUTSIDE, sourceId: active.id });
    expect(outcome).toEqual({ canceled: true, dropEffect: 'none', point: OUTSIDE, zoneId: null });
  });

  it('consults no zone when commit is false', async () => {
    const spies = zoneSpies();
    await addZone({ id: 'target', rect: rect(0, 0, 100, 100), ...spies });
    const active = lift();
    moveDrag(AT);

    expect(endDrag({ commit: false, point: AT, sourceId: active.id }).canceled).toBe(true);
    expect(spies.onDrop).not.toHaveBeenCalled();
  });

  it('reports a drop the platform claims even when no zone of ours took it', () => {
    const active = lift();

    // How a drop onto something outside the library still reads as a drop: the
    // browser's dragend says 'copy', and the store has no zone to credit.
    const outcome = endDrag({ commit: true, point: OUTSIDE, sourceId: active.id, transportDropEffect: 'copy' });
    expect(outcome).toEqual({ canceled: false, dropEffect: 'copy', point: OUTSIDE, zoneId: null });
  });

  it('ignores a transport effect of none, and one on a canceled gesture', () => {
    const first = lift();
    expect(endDrag({ commit: true, point: OUTSIDE, sourceId: first.id, transportDropEffect: 'none' }).canceled).toBe(true);
    const second = lift();
    expect(endDrag({ commit: false, point: OUTSIDE, sourceId: second.id, transportDropEffect: 'copy' }).canceled).toBe(true);
  });

  it('refuses to end a drag a different source started', async () => {
    const spies = zoneSpies();
    await addZone({ id: 'target', rect: rect(0, 0, 100, 100), ...spies });
    const active = lift({ id: 'mine' });
    moveDrag(AT);

    // A source unmounting mid-drag, or one whose gesture cancels late, must not
    // tear down someone else's drag — a zone would read a null drag while one was
    // plainly in flight.
    const outcome = endDrag({ commit: true, point: AT, sourceId: 'someone-else' });
    expect(outcome).toEqual({ canceled: true, dropEffect: 'none', point: AT, zoneId: null });
    expect(spies.onDrop).not.toHaveBeenCalled();
    expect(getActiveDrag()).toBe(active);
  });

  it('clears the session and publishes an idle snapshot', async () => {
    await addZone({ id: 'target', rect: rect(0, 0, 100, 100) });
    const active = lift();
    moveDrag(AT);

    endDrag({ commit: true, point: AT, sourceId: active.id });
    expect(getActiveDrag()).toBeNull();
    expect(getDragSnapshot()).toEqual({ drag: null, eligibleZoneIds: [], overZoneId: null, preview: null });
  });

  it('tells the zone, then the managers above it, then the managers above the source', async () => {
    const order: string[] = [];
    addManager('page', { onDragEnd: () => order.push('page-end'), onDrop: () => order.push('page-drop') });
    addManager('board', { onDragEnd: () => order.push('board-end'), onDrop: () => order.push('board-drop') }, 'page');
    await addZone({
      id: 'target',
      managerPath: ['page', 'board'],
      onDrop: () => order.push('zone-drop'),
      rect: rect(0, 0, 100, 100),
    });
    const active = lift({ managerPath: ['page', 'board'] });
    moveDrag(AT);

    endDrag({ commit: true, point: AT, sourceId: active.id });
    expect(order).toEqual(['zone-drop', 'board-drop', 'page-drop', 'board-end', 'page-end']);
  });

  it('tells the managers above the source about a cancel too', () => {
    const onDragEnd = vi.fn();
    addManager('board', { onDragEnd });
    const active = lift({ managerPath: ['board'] });

    endDrag({ commit: false, point: OUTSIDE, sourceId: active.id });
    expect(onDragEnd).toHaveBeenCalledWith(
      expect.objectContaining({ canceled: true, drag: active, dropEffect: 'none', zoneId: null }),
    );
  });
});

describe('cancelActiveDrag', () => {
  it('routes through the source, so its own teardown runs', () => {
    const onDragEnd = vi.fn();
    addManager('board', { onDragEnd });
    lift({ managerPath: ['board'] });

    cancelActiveDrag();

    // The source calls endDrag itself, which is what makes a manager's cancelDrag()
    // indistinguishable from the user abandoning the gesture.
    expect(getActiveDrag()).toBeNull();
    expect(onDragEnd).toHaveBeenCalledWith(expect.objectContaining({ canceled: true }));
  });

  it('is a no-op with nothing in flight', () => {
    expect(() => cancelActiveDrag()).not.toThrow();
  });
});

describe('registering during a drag', () => {
  it('makes a zone revealed by the drag eligible without restarting it', async () => {
    lift();
    expect(getDragSnapshot().eligibleZoneIds).toEqual([]);

    // The trash can that only appears once you lift something.
    await addZone({ id: 'trash', rect: rect(0, 0, 100, 100) });
    expect(getDragSnapshot().eligibleZoneIds).toEqual(['trash']);
    expect(moveDrag(AT)).toBe('trash');
  });

  it('leaves the drag over nothing when the zone under it unmounts', async () => {
    const registration = await addZone({ id: 'target', rect: rect(0, 0, 100, 100) });
    lift();
    moveDrag(AT);
    expect(getDragSnapshot().overZoneId).toBe('target');

    registration.unregister();
    expect(getDragSnapshot()).toEqual(expect.objectContaining({ eligibleZoneIds: [], overZoneId: null }));
  });

  it('recomputes eligibility when a manager mounts and isolates', async () => {
    await addZone({ id: 'outside', rect: rect(0, 0, 100, 100) });
    lift({ managerPath: ['board'] });
    expect(getDragSnapshot().eligibleZoneIds).toEqual(['outside']);

    // The source is under 'board'; the zone is not. Once 'board' isolates, they are
    // in different worlds.
    addManager('board', { isolate: true });
    expect(getDragSnapshot().eligibleZoneIds).toEqual([]);
  });
});

describe('the external path', () => {
  it('asks the zone whether it takes a foreign payload', async () => {
    const accepts = vi.fn(() => true);
    await addZone({ id: 'files', accepts, acceptsExternal: true, rect: rect(0, 0, 100, 100) });
    await addZone({ id: 'ours', rect: rect(0, 0, 100, 100) });
    const transfer = createDragTransfer();

    expect(canZoneAcceptExternal({ point: AT, transfer, zoneId: 'files' })).toBe(true);
    expect(accepts).toHaveBeenCalledWith(expect.objectContaining({ drag: null, external: true, zoneId: 'files' }));
    // Not opting in is the default: a zone built for in-library cards should not
    // start swallowing the user's file drags.
    expect(canZoneAcceptExternal({ point: AT, transfer, zoneId: 'ours' })).toBe(false);
    expect(canZoneAcceptExternal({ point: AT, transfer, zoneId: 'missing' })).toBe(false);
  });

  it('delivers to the zone and the managers above it, with no session involved', async () => {
    const onDrop = vi.fn();
    const managerDrop = vi.fn();
    addManager('page', { onDrop: managerDrop });
    await addZone({ id: 'files', acceptsExternal: true, managerPath: ['page'], onDrop, rect: rect(0, 0, 100, 100) });
    const transfer = createDragTransfer();
    transfer.setData('text/uri-list', 'https://example.com');
    const files = [new File(['a'], 'a.txt')];

    deliverExternalDrop({ files, point: AT, transfer, zoneId: 'files' });

    const event = { drag: null, external: true, files, point: AT, transfer, zoneId: 'files' };
    expect(onDrop).toHaveBeenCalledWith(event);
    expect(managerDrop).toHaveBeenCalledWith(event);
    expect(getActiveDrag()).toBeNull();
  });

  it('ignores a delivery to a zone that is not registered', () => {
    expect(() => deliverExternalDrop({ files: [], point: AT, transfer: createDragTransfer(), zoneId: 'gone' })).not.toThrow();
  });
});
