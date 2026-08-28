// Scrolling the list while a drag hovers near its edge.
//
// The one piece of the old drag stack with no equivalent in the gestures package,
// and deliberately not added to it: auto-scroll needs to know which scrollable a
// drag is over and how to move it, which is a property of the view, not of dragging.
// So it lives here, subscribed to the store's move channel — the same pointer
// stream the ghost rides, which reports every frame and re-renders nothing.
//
// The mechanics are shared with the mobile views' selection scrub and live in
// `use-file-system-auto-scroll.ts`; this hook is only the drag-store feed — it
// begins a scroll when a drag lifts, feeds the pointer in, and ends it on release.

import { useCallback, useEffect } from 'react';
import { useDragMove, useIsDragging } from '../../../gestures/use-drag-store';
import { type UseFileSystemAutoScrollParams, useFileSystemAutoScroll } from './use-file-system-auto-scroll';

export type UseFileSystemDragScrollParams = UseFileSystemAutoScrollParams & {
  /** `false` when the view is not draggable — nothing subscribes and no timer can start. */
  enabled: boolean;
};

/**
 * Scrolls the view's scrollable while a drag sits within the edge zones of
 * `containerRef`.
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
  const { begin, move, end } = useFileSystemAutoScroll({ containerRef, scrollTo, scrollOffsetRef });

  // The lifecycle channel: this hook runs inside a view that renders a row list, so
  // a subscription that also fired on zone crossings would re-render that whole list
  // once per folder boundary the drag sweeps over.
  const isDragging = useIsDragging() && enabled;

  // The box is measured when a drag starts and dropped when it ends, which also
  // stops any run still running — a drag released in the scroll zone would
  // otherwise keep the list moving after the pointer is gone.
  // biome-ignore lint/plugin: measuring at lift and clearing the run are effects on external state, not render-driving
  useEffect(() => {
    if (!isDragging) {
      end();
      return;
    }
    begin();
    return end;
  }, [begin, end, isDragging]);

  useDragMove(
    useCallback(
      (point) => {
        if (!isDragging) return;
        move(point.x, point.y);
      },
      [isDragging, move],
    ),
  );
}
