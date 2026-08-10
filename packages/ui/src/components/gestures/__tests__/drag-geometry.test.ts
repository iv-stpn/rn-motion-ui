import { describe, expect, it } from 'vitest';
import {
  draggableRectAt,
  ghostOffset,
  isPointInRect,
  rectArea,
  rectCenter,
  rectContains,
  rectsIntersect,
} from '../drag-geometry';
import { rect } from './drag-harness';

describe('isPointInRect', () => {
  const box = rect(10, 20, 100, 50);

  it('accepts a point inside', () => {
    expect(isPointInRect({ x: 50, y: 40 }, box)).toBe(true);
  });

  it('accepts the edges, so a drop on a zone border still lands', () => {
    expect(isPointInRect({ x: 10, y: 20 }, box)).toBe(true);
    expect(isPointInRect({ x: 110, y: 70 }, box)).toBe(true);
  });

  it('refuses a point outside on either axis', () => {
    expect(isPointInRect({ x: 9, y: 40 }, box)).toBe(false);
    expect(isPointInRect({ x: 111, y: 40 }, box)).toBe(false);
    expect(isPointInRect({ x: 50, y: 19 }, box)).toBe(false);
    expect(isPointInRect({ x: 50, y: 71 }, box)).toBe(false);
  });

  it('refuses everything for a zero-size box except its own corner', () => {
    const empty = rect(10, 20, 0, 0);
    expect(isPointInRect({ x: 10, y: 20 }, empty)).toBe(true);
    expect(isPointInRect({ x: 11, y: 20 }, empty)).toBe(false);
  });
});

describe('rectArea', () => {
  it('multiplies the sides', () => {
    expect(rectArea(rect(0, 0, 10, 4))).toBe(40);
  });

  it('ignores the origin, so two zones tie on size wherever they sit', () => {
    expect(rectArea(rect(500, 900, 10, 4))).toBe(rectArea(rect(0, 0, 10, 4)));
  });
});

describe('ghostOffset', () => {
  const origin = rect(100, 200, 60, 40);
  const grab = { x: 130, y: 210 };

  it('puts the ghost over the source before the pointer has moved', () => {
    expect(ghostOffset({ grab, host: null, origin, point: grab })).toEqual({ x: 100, y: 200 });
  });

  it('keeps the grip: the pointer holds the same part of the ghost it grabbed', () => {
    // Grabbed 30px right and 10px down from the source's corner; after moving the
    // pointer, the ghost's corner stays exactly that far from it rather than the
    // ghost re-centring itself, which would make the drag jump at lift.
    const offset = ghostOffset({ grab, host: null, origin, point: { x: 330, y: 410 } });
    expect(offset).toEqual({ x: 300, y: 400 });
    expect({ x: 330 - offset.x, y: 410 - offset.y }).toEqual({ x: 30, y: 10 });
  });

  it('subtracts the overlay host, so a manager inside an offset ancestor still tracks', () => {
    const host = rect(40, 60, 800, 600);
    expect(ghostOffset({ grab, host, origin, point: grab })).toEqual({ x: 60, y: 140 });
    expect(ghostOffset({ grab, host, origin, point: { x: 230, y: 310 } })).toEqual({ x: 160, y: 240 });
  });

  it('falls back to the pointer when the source never measured', () => {
    // No box to keep a grip on, so the ghost's top-left goes to the finger.
    expect(ghostOffset({ grab, host: null, origin: null, point: grab })).toEqual(grab);
    expect(ghostOffset({ grab, host: null, origin: null, point: { x: 200, y: 300 } })).toEqual({ x: 200, y: 300 });
  });

  it('moves the ghost exactly as far as the pointer', () => {
    const from = ghostOffset({ grab, host: rect(5, 7, 100, 100), origin, point: grab });
    const to = ghostOffset({ grab, host: rect(5, 7, 100, 100), origin, point: { x: grab.x + 17, y: grab.y - 23 } });
    expect({ x: to.x - from.x, y: to.y - from.y }).toEqual({ x: 17, y: -23 });
  });
});

describe('draggableRectAt', () => {
  const origin = rect(100, 200, 60, 40);
  const grab = { x: 130, y: 210 };

  it('returns the origin rect when the pointer has not moved from the grab', () => {
    expect(draggableRectAt(origin, grab, grab)).toEqual(origin);
  });

  it('moves the rect by the same delta the pointer travelled', () => {
    // Finger moved 70px right, 30px down from the grab point
    const result = draggableRectAt(origin, grab, { x: 200, y: 240 });
    expect(result).toEqual(rect(170, 230, 60, 40));
  });

  it('preserves the rect size — only the position changes', () => {
    const result = draggableRectAt(origin, grab, { x: 1000, y: 5 });
    expect(result.width).toBe(origin.width);
    expect(result.height).toBe(origin.height);
  });

  it('can move the rect into negative coordinates', () => {
    const result = draggableRectAt(origin, grab, { x: 30, y: 10 });
    expect(result).toEqual(rect(0, 0, 60, 40));
  });
});

describe('rectsIntersect', () => {
  const a = rect(0, 0, 100, 100);

  it('detects overlapping rects', () => {
    expect(rectsIntersect(a, rect(50, 50, 100, 100))).toBe(true);
  });

  it('detects one rect fully inside another', () => {
    expect(rectsIntersect(a, rect(20, 20, 30, 30))).toBe(true);
  });

  it('detects edge-touching rects', () => {
    expect(rectsIntersect(a, rect(100, 0, 100, 100))).toBe(true);
    expect(rectsIntersect(a, rect(0, 100, 100, 100))).toBe(true);
  });

  it('rejects rects with no shared area', () => {
    expect(rectsIntersect(a, rect(101, 0, 100, 100))).toBe(false);
    expect(rectsIntersect(a, rect(0, 101, 100, 100))).toBe(false);
  });

  it('is commutative', () => {
    const b = rect(30, 40, 50, 60);
    expect(rectsIntersect(a, b)).toBe(rectsIntersect(b, a));
  });
});

describe('rectContains', () => {
  const outer = rect(0, 0, 100, 100);

  it('accepts a rect fully inside', () => {
    expect(rectContains(outer, rect(10, 10, 50, 50))).toBe(true);
  });

  it('accepts a rect sharing an edge with the outer', () => {
    expect(rectContains(outer, rect(0, 0, 50, 50))).toBe(true);
    expect(rectContains(outer, rect(50, 50, 50, 50))).toBe(true);
  });

  it('rejects a rect that overflows on one side', () => {
    expect(rectContains(outer, rect(90, 0, 20, 50))).toBe(false);
    expect(rectContains(outer, rect(0, 90, 50, 20))).toBe(false);
  });

  it('rejects a rect entirely outside', () => {
    expect(rectContains(outer, rect(200, 200, 10, 10))).toBe(false);
  });

  it('rejects a rect larger than the outer', () => {
    expect(rectContains(outer, rect(-10, -10, 120, 120))).toBe(false);
  });
});

describe('rectCenter', () => {
  it('finds the midpoint of an even-sized rect', () => {
    expect(rectCenter(rect(0, 0, 100, 50))).toEqual({ x: 50, y: 25 });
  });

  it('finds the midpoint of an odd-sized rect', () => {
    expect(rectCenter(rect(10, 20, 51, 33))).toEqual({ x: 35.5, y: 36.5 });
  });

  it('returns the corner for a zero-area rect', () => {
    expect(rectCenter(rect(5, 7, 0, 0))).toEqual({ x: 5, y: 7 });
  });
});
