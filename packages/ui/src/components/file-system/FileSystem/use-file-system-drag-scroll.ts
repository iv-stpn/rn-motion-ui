// Scrolling the list while a drag hovers near its edge.
//
// The one piece of the old drag stack with no equivalent in the gestures package,
// and deliberately not added to it: auto-scroll needs to know which scrollable a
// drag is over and how to move it, which is a property of the view, not of dragging.
// So it lives here, subscribed to the store's move channel — the same pointer
// stream the ghost rides, which reports every frame and re-renders nothing.
//
// It reads the container's box once per lift rather than per move: a list does not
// move while it is being scrolled, and `getBoundingClientRect` on the pointer path
// is a layout read sixty times a second.

import { type RefObject, useCallback, useEffect, useRef } from 'react';
import type { View } from 'react-native';
import type { DragRect } from '../../gestures/drag.types';
import { useActiveDrag, useDragMove } from '../../gestures/use-drag-store';

/** How close to an edge the pointer has to get before the list starts moving. */
const SCROLL_ZONE = 36;
/** Pixels per tick — with the interval below, about 375 px/s. */
const SCROLL_STEP = 6;
const SCROLL_INTERVAL_MS = 16;

export type UseFileSystemDragScrollParams = {
  containerRef: RefObject<View | null>;
  /** `false` when the view is not draggable — nothing subscribes and no timer can start. */
  enabled: boolean;
  /** Moves the view's scrollable to a content-pixel offset — `scrollTo` on a ScrollView, `scrollToOffset` on a FlatList. */
  scrollTo: (offset: number) => void;
  /** Live scroll offset, so a tick moves from where the scrollable actually is. */
  scrollOffsetRef: RefObject<number>;
};

/**
 * Scrolls the view's scrollable while a drag sits within {@link SCROLL_ZONE} of the
 * top or bottom edge of `containerRef`.
 *
 * Runs for any drag the store knows about, including one lifted from another view
 * entirely — the move channel is tree-wide, not per-source.
 *
 * A payload dragged in from outside the app is the one case this cannot serve: the
 * store never saw that drag start, so it publishes no moves for it, and the
 * browser reports a foreign drag only at the node under it. Such a drop still
 * lands, on whatever is visible; it just will not scroll the list to find a target.
 */
export function useFileSystemDragScroll({
  containerRef,
  enabled,
  scrollTo,
  scrollOffsetRef,
}: UseFileSystemDragScrollParams): void {
  const rectRef = useRef<DragRect | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Read by the running timer rather than captured by it, so crossing from the top
  // zone to the bottom one reverses the existing interval instead of leaving it
  // scrolling the wrong way.
  const deltaRef = useRef(0);

  const stop = useCallback(() => {
    if (timerRef.current === null) return;
    clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const start = useCallback(
    (delta: number) => {
      deltaRef.current = delta;
      if (timerRef.current !== null) return;
      timerRef.current = setInterval(() => {
        const offset = Math.max(0, scrollOffsetRef.current + deltaRef.current);
        scrollTo(offset);
      }, SCROLL_INTERVAL_MS);
    },
    [scrollTo, scrollOffsetRef],
  );

  const drag = useActiveDrag();
  const isDragging = enabled && drag !== null;

  // The box is measured when a drag starts and dropped when it ends, which also
  // stops any timer still running — a drag released in the scroll zone would
  // otherwise keep the list moving after the pointer is gone.
  // biome-ignore lint/plugin: measuring at lift and clearing the timer are effects on external state, not render-driving
  useEffect(() => {
    if (!isDragging) {
      rectRef.current = null;
      stop();
      return;
    }
    const node = containerRef.current;
    node?.measureInWindow((x, y, width, height) => {
      rectRef.current = { height, width, x, y };
    });
    return stop;
  }, [containerRef, isDragging, stop]);

  useDragMove(
    useCallback(
      (point) => {
        const rect = rectRef.current;
        if (!isDragging || rect === null || rect.height <= 0) return;
        const localY = point.y - rect.y;
        // Outside the container entirely: a drag on its way somewhere else should
        // not drive this list.
        if (localY < -SCROLL_ZONE || localY > rect.height + SCROLL_ZONE) return stop();
        if (localY < SCROLL_ZONE) return start(-SCROLL_STEP);
        if (localY > rect.height - SCROLL_ZONE) return start(SCROLL_STEP);
        return stop();
      },
      [isDragging, start, stop],
    ),
  );
}
