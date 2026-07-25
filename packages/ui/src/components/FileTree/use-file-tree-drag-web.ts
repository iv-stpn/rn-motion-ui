/** biome-ignore-all lint/style/useExportsLast: exported types + module-private helpers interleave by concern */
// Web drag transport: raw pointer events on the scroll container, feeding the
// platform-agnostic `FileTreeDragSession`.
//
// Why not react-native-gesture-handler here? Its web implementation calls
// `setPointerCapture` on `event.target` — the descendant row node the press
// landed on. Activating a drag re-renders the list, that node loses the capture,
// and RNGH's `lostpointercapture` handler synthesizes a `pointercancel` that
// zeroes its pointer bookkeeping. The pan dies after a single `pointermove`, so
// the drop resolves against the row the drag *started* on and lands as a no-op.
//
// Capturing on the container sidesteps the whole class of problem: that node
// outlives every re-render a drag can cause, so the pointer stream is stable by
// construction. Coordinates come from the container's own rect, which is also the
// frame the drop highlight and drag preview are positioned in.

import { type RefObject, useEffect } from 'react';
import { Platform, type View } from 'react-native';
import { DRAG_LONG_PRESS, type FileTreeDragSession } from './use-file-tree-drag';

/** Movement (px) before the arming long-press lands that reads as a scroll, not a drag. */
const ARM_SLOP = 10;

export type FileTreeDragWebParams = {
  enabled: boolean;
  /** The scroll container — the capture host, and the coordinate origin. */
  containerRef: RefObject<View | null>;
  session: FileTreeDragSession;
};

/** Mutable per-gesture bookkeeping for one pointer's trip through the container. */
type PointerTrip = {
  id: number | null;
  startX: number;
  startY: number;
  timer: ReturnType<typeof setTimeout> | null;
  dragging: boolean;
};

/**
 * Route the pointer stream to the container for the rest of the drag. Best-effort
 * by design: capture throws when the browser holds no active pointer with that id
 * (synthetic events in tests, or a release that raced the long-press timer). The
 * container is an ancestor of every row, so events still bubble to it either way —
 * capture only extends that to moves that stray outside its box.
 */
function capturePointer(node: HTMLElement, pointerId: number): void {
  try {
    node.setPointerCapture(pointerId);
  } catch {
    // No active pointer to capture; the bubbling path still drives the drag.
  }
}

function buildPointerListeners(node: HTMLElement, session: FileTreeDragSession) {
  const trip: PointerTrip = { id: null, startX: 0, startY: 0, timer: null, dragging: false };

  const localPoint = (event: PointerEvent) => {
    const rect = node.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const reset = () => {
    if (trip.timer !== null) clearTimeout(trip.timer);
    trip.timer = null;
    trip.id = null;
    trip.dragging = false;
  };

  const onPointerDown = (event: PointerEvent) => {
    // One pointer, primary button only — right-click still reaches the context menu.
    if (trip.id !== null || event.button !== 0) return;
    const point = localPoint(event);
    trip.id = event.pointerId;
    trip.startX = point.x;
    trip.startY = point.y;
    trip.timer = setTimeout(() => {
      trip.timer = null;
      if (trip.id === null) return;
      if (!session.begin(trip.startX, trip.startY)) {
        reset();
        return;
      }
      trip.dragging = true;
      capturePointer(node, trip.id);
    }, DRAG_LONG_PRESS);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== trip.id) return;
    const point = localPoint(event);
    if (!trip.dragging) {
      // Moving before the long-press lands means the user is scrolling.
      if (Math.abs(point.x - trip.startX) > ARM_SLOP || Math.abs(point.y - trip.startY) > ARM_SLOP) reset();
      return;
    }
    // Non-passive: suppresses touch scrolling and text selection mid-drag.
    event.preventDefault();
    session.move(point.x, point.y);
  };

  /** Both endings share the teardown; only whether the move commits differs. */
  const endWith = (commit: boolean) => (event: PointerEvent) => {
    if (event.pointerId !== trip.id) return;
    const wasDragging = trip.dragging;
    reset();
    if (wasDragging) session.finish(commit);
  };

  return { onPointerDown, onPointerMove, onPointerUp: endWith(true), onPointerAbort: endWith(false), reset };
}

/**
 * Drives the drag session from pointer events on the container. No-op on native,
 * where the RNGH pan in `useFileTreeDrag` handles it.
 */
export function useFileTreeDragWeb({ enabled, containerRef, session }: FileTreeDragWebParams): void {
  // biome-ignore lint/plugin: pointer capture is an external side effect that must be bound on the host node — RNW's responder system cannot express "capture on the scroll container, not the pressed row".
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    // biome-ignore lint/plugin: on web RNW renders the View to a DOM element, so the ref is really an HTMLElement; RN's View type can't express that.
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    const listeners = buildPointerListeners(node, session);
    node.addEventListener('pointerdown', listeners.onPointerDown);
    node.addEventListener('pointermove', listeners.onPointerMove, { passive: false });
    node.addEventListener('pointerup', listeners.onPointerUp);
    node.addEventListener('pointercancel', listeners.onPointerAbort);
    // Defence in depth: capture on the container should never be lost mid-drag,
    // but if something does steal it, abort rather than strand an active drag.
    node.addEventListener('lostpointercapture', listeners.onPointerAbort);
    return () => {
      node.removeEventListener('pointerdown', listeners.onPointerDown);
      node.removeEventListener('pointermove', listeners.onPointerMove);
      node.removeEventListener('pointerup', listeners.onPointerUp);
      node.removeEventListener('pointercancel', listeners.onPointerAbort);
      node.removeEventListener('lostpointercapture', listeners.onPointerAbort);
      listeners.reset();
    };
  }, [enabled, containerRef, session]);
}
