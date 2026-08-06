// Boxes and points, with nothing else in the graph.
//
// Every coordinate in the drag system is in window space — `measureInWindow` on
// native, `clientX/Y` on web — which is the one frame both platforms can describe
// a pointer and a box in at the same time. The single conversion out of it is
// {@link ghostOffset}, for the case where a `<DragManager>` draws the ghost inside
// its own frame rather than the window's.
//
// Pure, and separate from the components for the reason given in `drag.types.ts`:
// vitest cannot import anything that reaches react-native, so the arithmetic a
// drag depends on lives where it can actually be tested.

import type { DragPoint, DragRect } from './drag.types';

const ORIGIN: DragPoint = { x: 0, y: 0 };

/** Whether `point` is inside `rect`, edges included. */
export function isPointInRect(point: DragPoint, rect: DragRect): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

/** The area of a rect — the tie-break between two zones at the same nesting depth. */
export function rectArea(rect: DragRect): number {
  return rect.width * rect.height;
}

export type GhostOffsetParams = {
  /** Where the pointer grabbed, in window coordinates. */
  grab: DragPoint;
  /** The frame the ghost is drawn in: the overlay host's box, or `null` for the window. */
  host: DragRect | null;
  /** The source's box at lift time, or `null` when it never measured. */
  origin: DragRect | null;
  /** Where the pointer is now, in window coordinates. */
  point: DragPoint;
};

/**
 * Where to draw the ghost, as a translate off its container's top-left corner.
 *
 * The ghost is absolutely positioned at (0, 0) of whatever draws it, so the whole
 * of its placement is this offset — which keeps the animated part to one
 * `ValueXY` and off the React tree entirely.
 *
 * Two frames meet here. The source's box and the pointer are both in window
 * coordinates; the overlay host draws in its own. Subtracting the host's origin is
 * the conversion, and it is why a manager inside a scrolled or offset ancestor
 * still puts the ghost under the finger.
 *
 * The pointer keeps its grip on the same part of the ghost as at lift time, rather
 * than the ghost centring itself on the pointer: a card grabbed by its corner
 * should stay grabbed by its corner, or the drag appears to jump the instant it
 * starts. With no `origin` — a source that never laid out — the ghost's top-left
 * goes to the pointer, which is the only defensible guess left.
 */
export function ghostOffset({ grab, host, origin, point }: GhostOffsetParams): DragPoint {
  const frame = host ?? ORIGIN;
  const anchor = origin === null ? grab : origin;
  return { x: anchor.x - frame.x + (point.x - grab.x), y: anchor.y - frame.y + (point.y - grab.y) };
}
