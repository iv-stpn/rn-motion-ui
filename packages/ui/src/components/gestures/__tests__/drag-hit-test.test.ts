import { describe, expect, it, vi } from 'vitest';
import { deepestIsolator, eligibleZoneIds, isZoneEligible, resolveDropTarget } from '../drag-hit-test';
import { createDragTransfer } from '../drag-transfer';
import { drag, isolators, rect, zone } from './drag-harness';

const NO_ISOLATION = () => false;
const INSIDE = { x: 50, y: 50 };

describe('deepestIsolator', () => {
  it('is null when nothing on the path isolates', () => {
    expect(deepestIsolator(['root', 'board'], NO_ISOLATION)).toBeNull();
    expect(deepestIsolator([], isolators('root'))).toBeNull();
  });

  it('reads the innermost isolator, not the outermost', () => {
    // An isolated board inside an isolated page is its own world: a card dragged
    // in the board must not reach a zone that only shares the page with it.
    expect(deepestIsolator(['page', 'board', 'column'], isolators('page', 'board'))).toBe('board');
  });

  it('ignores isolators that are not on the path', () => {
    expect(deepestIsolator(['page'], isolators('other'))).toBeNull();
  });
});

describe('isZoneEligible', () => {
  const ask = (entry: ReturnType<typeof zone>, options: Partial<Parameters<typeof isZoneEligible>[0]> = {}) =>
    isZoneEligible({
      drag: drag(),
      entry,
      external: false,
      hitTest: false,
      isIsolating: NO_ISOLATION,
      point: INSIDE,
      transfer: createDragTransfer(),
      ...options,
    });

  it('accepts a zone that declares nothing', () => {
    expect(ask(zone({ id: 'a' }))).toBe(true);
  });

  it('refuses a disabled zone before anything else is asked', () => {
    const accepts = vi.fn(() => true);
    expect(ask(zone({ accepts, disabled: true, id: 'a' }))).toBe(false);
    expect(accepts).not.toHaveBeenCalled();
  });

  it('refuses a group it does not share', () => {
    const entry = zone({ groups: ['files'], id: 'a' });
    expect(ask(entry, { drag: drag({ groups: ['cards'] }) })).toBe(false);
    expect(ask(entry, { drag: drag({ groups: ['cards', 'files'] }) })).toBe(true);
  });

  it('keeps a drag inside its isolated subtree, in both directions', () => {
    const isIsolating = isolators('board');
    const inside = zone({ id: 'inside', managerPath: ['page', 'board'] });
    const outside = zone({ id: 'outside', managerPath: ['page'] });
    const fromInside = drag({ managerPath: ['page', 'board'] });
    const fromOutside = drag({ managerPath: ['page'] });

    expect(ask(inside, { drag: fromInside, isIsolating })).toBe(true);
    expect(ask(outside, { drag: fromInside, isIsolating })).toBe(false);
    expect(ask(inside, { drag: fromOutside, isIsolating })).toBe(false);
    expect(ask(outside, { drag: fromOutside, isIsolating })).toBe(true);
  });

  it('lets two zones under the same isolator reach each other', () => {
    const isIsolating = isolators('board');
    const entry = zone({ id: 'slot', managerPath: ['page', 'board', 'column'] });
    expect(ask(entry, { drag: drag({ managerPath: ['page', 'board'] }), isIsolating })).toBe(true);
  });

  it('tests the box only when asked to', () => {
    const entry = zone({ id: 'a', rect: rect(0, 0, 10, 10) });
    expect(ask(entry, { hitTest: false, point: { x: 500, y: 500 } })).toBe(true);
    expect(ask(entry, { hitTest: true, point: { x: 500, y: 500 } })).toBe(false);
    expect(ask(entry, { hitTest: true, point: { x: 5, y: 5 } })).toBe(true);
  });

  it('keeps an unmeasured zone eligible in the abstract but never under the pointer', () => {
    // The affordance should not blink off for the frame between a layout change
    // and the measure that follows it.
    const entry = zone({ id: 'a', rect: null });
    expect(ask(entry, { hitTest: false })).toBe(true);
    expect(ask(entry, { hitTest: true })).toBe(false);
  });

  it('gives accepts the last word, and tells it which zone is asking', () => {
    const accepts = vi.fn(() => false);
    expect(ask(zone({ accepts, id: 'a' }))).toBe(false);
    expect(accepts).toHaveBeenCalledWith(expect.objectContaining({ external: false, point: INSIDE, zoneId: 'a' }));
  });

  describe('an external payload', () => {
    const external = { drag: null, external: true };

    it('needs acceptsExternal', () => {
      expect(ask(zone({ id: 'a' }), external)).toBe(false);
      expect(ask(zone({ acceptsExternal: true, id: 'a' }), external)).toBe(true);
    });

    it('skips groups and isolation, which have nothing to say about it', () => {
      const entry = zone({ acceptsExternal: true, groups: ['files'], id: 'a', managerPath: ['page', 'board'] });
      expect(ask(entry, { ...external, isIsolating: isolators('board') })).toBe(true);
    });

    it('still faces accepts, with no drag to describe', () => {
      const accepts = vi.fn(() => true);
      ask(zone({ accepts, acceptsExternal: true, id: 'a' }), external);
      expect(accepts).toHaveBeenCalledWith(expect.objectContaining({ drag: null, external: true }));
    });
  });
});

describe('resolveDropTarget', () => {
  const resolve = (zones: readonly ReturnType<typeof zone>[], point = INSIDE) =>
    resolveDropTarget({ drag: drag(), external: false, isIsolating: NO_ISOLATION, point, transfer: createDragTransfer(), zones })
      ?.id ?? null;

  it('is null when the pointer is over nothing', () => {
    expect(resolve([zone({ id: 'a', rect: rect(0, 0, 10, 10) })], { x: 900, y: 900 })).toBeNull();
    expect(resolve([])).toBeNull();
  });

  it('takes an explicit priority over everything else', () => {
    const big = zone({ id: 'big', priority: 1, rect: rect(0, 0, 100, 100) });
    const small = zone({ id: 'small', managerPath: ['inner'], rect: rect(40, 40, 20, 20) });
    expect(resolve([big, small])).toBe('big');
  });

  it('prefers the deeper manager over the smaller box', () => {
    // Nesting is what the consumer actually modelled, so it outranks whatever the
    // two boxes happen to measure.
    const shallowSmall = zone({ id: 'shallow', rect: rect(45, 45, 10, 10) });
    const deepLarge = zone({ id: 'deep', managerPath: ['page', 'board'], rect: rect(0, 0, 100, 100) });
    expect(resolve([shallowSmall, deepLarge])).toBe('deep');
  });

  it('prefers the smaller box between two zones under the same manager', () => {
    const column = zone({ id: 'column', managerPath: ['board'], rect: rect(0, 0, 100, 100) });
    const slot = zone({ id: 'slot', managerPath: ['board'], rect: rect(40, 40, 20, 20) });
    expect(resolve([column, slot])).toBe('slot');
    expect(resolve([slot, column])).toBe('slot');
  });

  it('falls back to mount order when two zones are otherwise identical', () => {
    const first = zone({ id: 'first', rect: rect(0, 0, 100, 100) });
    const second = zone({ id: 'second', rect: rect(0, 0, 100, 100) });
    expect(resolve([first, second])).toBe('first');
    expect(resolve([second, first])).toBe('second');
  });

  it('never returns a zone that refused the drag', () => {
    const refuses = zone({ accepts: () => false, id: 'refuses', priority: 10, rect: rect(0, 0, 100, 100) });
    const takes = zone({ id: 'takes', rect: rect(0, 0, 100, 100) });
    expect(resolve([refuses, takes])).toBe('takes');
  });
});

describe('eligibleZoneIds', () => {
  const ids = (zones: readonly ReturnType<typeof zone>[]) =>
    eligibleZoneIds({
      drag: drag({ groups: ['cards'] }),
      external: false,
      isIsolating: NO_ISOLATION,
      point: { x: 900, y: 900 },
      transfer: createDragTransfer(),
      zones,
    });

  it('lists every zone that could take the drag, wherever the pointer is', () => {
    const zones = [
      zone({ groups: ['cards'], id: 'match', rect: rect(0, 0, 10, 10) }),
      zone({ groups: ['files'], id: 'other', rect: rect(0, 0, 10, 10) }),
      zone({ disabled: true, groups: ['cards'], id: 'off', rect: rect(0, 0, 10, 10) }),
      zone({ id: 'wildcard', rect: null }),
    ];
    expect(ids(zones)).toEqual(['match', 'wildcard']);
  });

  it('is empty when nothing matches', () => {
    expect(ids([zone({ groups: ['files'], id: 'other' })])).toEqual([]);
  });
});

describe('rect-based collision algorithms', () => {
  const sourceRect = rect(40, 40, 60, 40); // 60×40 at (40,40) → center at (70, 60)
  const zoneRect = rect(0, 0, 100, 100);
  const entry = zone({ id: 'a', rect: zoneRect });

  const ask = (options: Partial<Parameters<typeof isZoneEligible>[0]> = {}) =>
    isZoneEligible({
      drag: drag(),
      entry,
      external: false,
      hitTest: true,
      isIsolating: () => false,
      point: { x: 90, y: 70 },
      transfer: createDragTransfer(),
      ...options,
    });

  it('with intersect, accepts when the source rect overlaps the zone', () => {
    // sourceRect (40,40,60,40) overlaps zone (0,0,100,100)
    expect(
      ask({
        drag: drag({ collisionAlgorithm: 'intersect', origin: { grab: { x: 10, y: 10 }, rect: sourceRect } }),
        sourceRect,
      }),
    ).toBe(true);
  });

  it('with intersect, refuses when the source rect is outside the zone', () => {
    const outside = rect(200, 200, 60, 40);
    expect(
      ask({
        drag: drag({ collisionAlgorithm: 'intersect', origin: { grab: { x: 10, y: 10 }, rect: outside } }),
        point: { x: 210, y: 210 },
        sourceRect: outside,
      }),
    ).toBe(false);
  });

  it('with contain, accepts when the source is fully inside the zone', () => {
    // sourceRect (20,20,30,20) is entirely inside zone (0,0,100,100)
    const inside = rect(20, 20, 30, 20);
    expect(
      ask({
        drag: drag({ collisionAlgorithm: 'contain', origin: { grab: { x: 10, y: 10 }, rect: inside } }),
        sourceRect: inside,
      }),
    ).toBe(true);
  });

  it('with contain, refuses when the source overflows the zone', () => {
    // sourceRect (90,90,60,40) overflows zone (0,0,100,100) on both right and bottom
    const overflow = rect(90, 90, 60, 40);
    expect(
      ask({
        drag: drag({ collisionAlgorithm: 'contain', origin: { grab: { x: 10, y: 10 }, rect: overflow } }),
        sourceRect: overflow,
      }),
    ).toBe(false);
  });

  it('with center, accepts when the source center is inside the zone', () => {
    // sourceRect center (70,60) is inside zone (0,0,100,100)
    expect(
      ask({
        drag: drag({ collisionAlgorithm: 'center', origin: { grab: { x: 10, y: 10 }, rect: sourceRect } }),
        sourceRect,
      }),
    ).toBe(true);
  });

  it('with center, refuses when the source center is outside the zone', () => {
    // sourceRect (90,90,40,40) → center at (110,110) is outside zone (0,0,100,100)
    const offCenter = rect(90, 90, 40, 40);
    expect(
      ask({
        drag: drag({ collisionAlgorithm: 'center', origin: { grab: { x: 10, y: 10 }, rect: offCenter } }),
        point: { x: 100, y: 100 },
        sourceRect: offCenter,
      }),
    ).toBe(false);
  });

  it('falls back to point-based when no algorithm is set', () => {
    // Point at (90,70) is inside zone (0,0,100,100) → point-based accepts
    expect(ask()).toBe(true);
    // Point at (500,500) is outside → point-based refuses
    expect(ask({ point: { x: 500, y: 500 } })).toBe(false);
  });

  it('with an algorithm but no sourceRect, falls back to point-based', () => {
    // Point (90,70) is inside the zone → accepts on point
    expect(
      ask({
        drag: drag({ collisionAlgorithm: 'intersect' }),
        // No sourceRect — algorithm can't run
      }),
    ).toBe(true);
  });
});
