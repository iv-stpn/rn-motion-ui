// The shared edge-scroll engine for the file-system views' scrollables.
//
// Extracted from `use-file-system-drag-scroll.ts` so the two gestures that move a
// scrollable — a drag over its edge, and the mobile views' selection scrub — share
// one monotonic-cursor rAF loop instead of two drifting copies. The engine is a
// property of the view's scrollable, not of any one gesture: it only needs a way to
// be measured, a way to be scrolled, and the live offset to seed a run from.
//
// It reads the container's box once per gesture rather than per move: a list does not
// move while it is being scrolled, and `measureInWindow` on the pointer path is a
// layout read sixty times a second.
//
// Smoothness mechanics (2026-08-18): the old loop stepped the offset by a fixed
// 6px every 16ms and re-read the LIVE scroll offset each tick. Scroll events land
// a frame late on native, so the read was frequently stale: the same offset was
// commanded two frames in a row (movement on every OTHER frame — the staggered
// steps) and could even command a smaller value than the previous one (a visible
// backward hop). Now the engine owns a monotonic offset CURSOR, seeded from the
// live offset once per run and never re-read while running, and commands it every
// animation frame. Speed is a velocity integrated from a TARGET set by how deep
// the pointer sits in the edge zone (0 at the zone's boundary → max at the edge),
// with acceleration ramping in and deceleration easing out — including through
// zero when the pointer crosses from the top zone to the bottom one.

import { type RefObject, useCallback, useRef } from 'react';
import type { View } from 'react-native';
import type { DragRect } from '../../../gestures/drag.types';

/** How close to an edge the pointer has to get before the list starts moving. */
const SCROLL_ZONE = 36;
/** Top speed, px/s — same as the old fixed 6px/16ms step (~375 px/s). */
const MAX_SCROLL_SPEED = 375;
/** Ramp-up: full speed is reached in ~160ms, so the list glides in instead of jumping. */
const SCROLL_ACCELERATION = 2400;
/** Ramp-down: ~230ms to ease to a stop, and the rate used when reversing direction. */
const SCROLL_DECELERATION = 1600;
/** Below this speed a run with no target is ended — motion is imperceptible. */
const MIN_SCROLL_SPEED = 10;
/** dt clamp: a backgrounded tab can resume with a huge gap between frames; never move more than this. */
const MAX_FRAME_MS = 32;

/** One auto-scroll run: a rAF loop commanding the scrollable every frame. */
type AutoScrollRun = {
  /** Current signed speed, px/s (negative = toward the top). */
  velocity: number;
  /** This run's monotonic offset cursor — what the scrollable was last told to do. */
  offset: number;
  /** Handle of the scheduled frame, for cancel. */
  rafId: number;
  /** Timestamp of the last frame; -1 until the first frame delivers one. */
  lastTs: number;
};

export type UseFileSystemAutoScrollParams = {
  /** The container whose window box the pointer is measured against. */
  containerRef: RefObject<View | null>;
  /** Moves the view's scrollable to a content-pixel offset — `scrollTo` on a ScrollView, `scrollToOffset` on a FlatList. */
  scrollTo: (offset: number) => void;
  /** Live scroll offset, used to SEED a run; the run then commands its own cursor. */
  scrollOffsetRef: RefObject<number>;
};

export type FileSystemAutoScroll = {
  /** Measures the container, arming the next `move`. Call on gesture start. */
  begin: () => void;
  /** Feeds a pointer window position; scrolls while it sits in either edge zone. */
  move: (x: number, y: number) => void;
  /** Drops the measured box and stops any run. Call on gesture end. */
  end: () => void;
};

/**
 * Scrolls a scrollable while a pointer sits within {@link SCROLL_ZONE} of the top or
 * bottom edge of `containerRef`.
 *
 * The caller owns when a gesture is live: `begin` on start (measuring the box), `move`
 * for every pointer update, `end` on release. This is the engine shared by
 * `useFileSystemDragScroll` (drag-store feed) and the mobile views' selection scrub.
 */
export function useFileSystemAutoScroll({
  containerRef,
  scrollTo,
  scrollOffsetRef,
}: UseFileSystemAutoScrollParams): FileSystemAutoScroll {
  const rectRef = useRef<DragRect | null>(null);
  const runRef = useRef<AutoScrollRun | null>(null);
  // Written by the move handler, read by the loop: the velocity the scroll should
  // be heading toward, 0 when the pointer is outside both edge zones.
  const targetVelocityRef = useRef(0);

  const cancel = useCallback(() => {
    targetVelocityRef.current = 0;
    const run = runRef.current;
    if (run === null) return;
    cancelAnimationFrame(run.rafId);
    runRef.current = null;
  }, []);

  // One frame of a run. dt is derived from the rAF timestamps so the cursor moves
  // at the integrated velocity regardless of how the frames land.
  const tick = useCallback(
    (ts: number) => {
      const run = runRef.current;
      if (run === null) return;
      if (run.lastTs < 0) {
        // First frame: record the clock so the second frame has a real dt.
        run.lastTs = ts;
        run.rafId = requestAnimationFrame(tick);
        return;
      }
      const dt = Math.min(Math.max(ts - run.lastTs, 0), MAX_FRAME_MS) / 1000;
      run.lastTs = ts;

      const target = targetVelocityRef.current;
      const error = target - run.velocity;
      if (error !== 0) {
        // Reversing (velocity and target have opposite signs) or stopping uses the
        // gentler deceleration, so a direction flip eases through zero.
        const slowing = run.velocity !== 0 && Math.sign(run.velocity) !== Math.sign(target);
        const step = (slowing || target === 0 ? SCROLL_DECELERATION : SCROLL_ACCELERATION) * dt;
        run.velocity = Math.abs(error) <= step ? target : run.velocity + Math.sign(error) * step;
      }

      run.offset = Math.max(0, run.offset + run.velocity * dt);
      scrollTo(run.offset);

      // End the run when the pointer is out of the zones (target 0) and the
      // velocity has decayed below perceptible motion. Any other state keeps the
      // loop alive — including velocity 0 with a non-zero target, which is the
      // first frame of acceleration from a standstill.
      if (target === 0 && Math.abs(run.velocity) < MIN_SCROLL_SPEED) {
        runRef.current = null;
        return;
      }
      run.rafId = requestAnimationFrame(tick);
    },
    [scrollTo],
  );

  const setTarget = useCallback(
    (velocity: number) => {
      targetVelocityRef.current = velocity;
      if (runRef.current !== null) return;
      if (velocity === 0) return;
      // Seed the run's cursor from the live offset. The list is stationary when a
      // run starts (the pointer just entered the zone), so the last onScroll value
      // is accurate; from here the loop commands its own monotonic cursor.
      runRef.current = {
        velocity: 0,
        offset: scrollOffsetRef.current,
        rafId: 0,
        lastTs: -1,
      };
      runRef.current.rafId = requestAnimationFrame(tick);
    },
    [scrollOffsetRef, tick],
  );

  const begin = useCallback(() => {
    const node = containerRef.current;
    node?.measureInWindow((x, y, width, height) => {
      rectRef.current = { height, width, x, y };
    });
  }, [containerRef]);

  const end = useCallback(() => {
    rectRef.current = null;
    cancel();
  }, [cancel]);

  const move = useCallback(
    (_x: number, y: number) => {
      const rect = rectRef.current;
      if (rect === null || rect.height <= 0) return;
      const localY = y - rect.y;
      // Outside the container entirely: a pointer on its way somewhere else should
      // not drive this list.
      if (localY < -SCROLL_ZONE || localY > rect.height + SCROLL_ZONE) return cancel();
      // Depth in the edge zone (0 at its boundary → 1 at the edge) scales the
      // target speed: hovering just inside scrolls slowly, pushing to the edge
      // runs at full speed.
      let target = 0;
      if (localY < SCROLL_ZONE) target = -(1 - localY / SCROLL_ZONE) * MAX_SCROLL_SPEED;
      else if (localY > rect.height - SCROLL_ZONE) target = (1 - (rect.height - localY) / SCROLL_ZONE) * MAX_SCROLL_SPEED;
      setTarget(target);
    },
    [cancel, setTarget],
  );

  return { begin, move, end };
}
