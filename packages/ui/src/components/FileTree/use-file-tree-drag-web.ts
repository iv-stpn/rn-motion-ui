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
//
// Arming is per input type, because the conflict is per input type. A mouse or
// pen has nothing to disambiguate — a press that moves is a drag, full stop, so
// it starts as soon as the pointer clears a few pixels. A finger has to serve
// both dragging and scrolling from the same downstroke, so touch alone waits for
// a stationary hold, and any movement before that hold lands is read as a scroll.

import { type RefObject, useEffect, useRef } from 'react';
import { Platform, type View } from 'react-native';
import { DRAG_LONG_PRESS, type FileTreeDragSession } from './use-file-tree-drag';

/** Movement (px) that turns a mouse/pen press into a drag. Small: a click barely moves. */
const MOUSE_DRAG_SLOP = 4;
/** Movement (px) before a touch's hold lands that reads as a scroll, not a drag. */
const TOUCH_ARM_SLOP = 10;

export type FileTreeDragWebParams = {
  enabled: boolean;
  /** The scroll container — the capture host, and the coordinate origin. */
  containerRef: RefObject<View | null>;
  session: FileTreeDragSession;
};

/** Mutable per-gesture bookkeeping for one pointer's trip through the container. */
type PointerTrip = {
  id: number | null;
  /** Touch waits for a hold; mouse and pen drag as soon as they move. */
  touch: boolean;
  startX: number;
  startY: number;
  timer: ReturnType<typeof setTimeout> | null;
  dragging: boolean;
};

/**
 * One bit: a drag just ended, so swallow the click the browser sends after the
 * release. It lives outside the listener set *and* outside the effect because it
 * has to survive both — committing a move changes the row list, which rebuilds the
 * session, which rebinds the listeners, all in the gap between the release and the
 * click. A flag held in a listener closure would be gone by the time it mattered.
 */
type ClickGate = { swallow: boolean };

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

/**
 * True when the press landed in a text field — the inline rename input owns its
 * own caret and selection, so a press there must never become a drag.
 */
function isTextEntry(target: EventTarget | null): boolean {
  // biome-ignore lint/plugin: DOM event targets are typed as EventTarget; reaching `closest` needs the Element shape.
  const node = target as { closest?: (selector: string) => unknown } | null;
  return Boolean(node?.closest?.('input, textarea'));
}

function buildPointerListeners(node: HTMLElement, session: FileTreeDragSession, gate: ClickGate) {
  const trip: PointerTrip = { id: null, touch: false, startX: 0, startY: 0, timer: null, dragging: false };

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

  /** Arm the drag at the *press* point, so it picks up the row that was pressed. */
  const startDrag = (): boolean => {
    if (trip.id === null || !session.begin(trip.startX, trip.startY)) return false;
    trip.dragging = true;
    capturePointer(node, trip.id);
    return true;
  };

  const onPointerDown = (event: PointerEvent) => {
    // Stale suppression can't outlive the next press (a drag whose click never came).
    gate.swallow = false;
    // One pointer, primary button only — right-click still reaches the context menu.
    if (trip.id !== null || event.button !== 0 || isTextEntry(event.target)) return;
    const point = localPoint(event);
    trip.id = event.pointerId;
    trip.touch = event.pointerType === 'touch';
    trip.startX = point.x;
    trip.startY = point.y;
    // Only touch waits: a hold is how a finger says "drag" rather than "scroll".
    if (!trip.touch) return;
    trip.timer = setTimeout(() => {
      trip.timer = null;
      if (!startDrag()) reset();
    }, DRAG_LONG_PRESS);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== trip.id) return;
    const point = localPoint(event);
    if (!trip.dragging) {
      const dx = Math.abs(point.x - trip.startX);
      const dy = Math.abs(point.y - trip.startY);
      if (trip.touch) {
        // Moving before the hold lands means the user is scrolling.
        if (dx > TOUCH_ARM_SLOP || dy > TOUCH_ARM_SLOP) reset();
        return;
      }
      if (dx <= MOUSE_DRAG_SLOP && dy <= MOUSE_DRAG_SLOP) return;
      if (!startDrag()) {
        reset();
        return;
      }
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
    if (!wasDragging) return;
    // A drag is not a click. The browser sends one anyway after the release, and
    // letting it through would select or expand whatever the drop landed on.
    gate.swallow = true;
    session.finish(commit);
  };

  return { onPointerDown, onPointerMove, onPointerUp: endWith(true), onPointerAbort: endWith(false), reset };
}

/**
 * Capture phase on the container, which is above every row and below React's root
 * listener: stopping propagation here means the row's `onPress` never sees the
 * post-drag click. One-shot — the next real click gets through untouched.
 */
function buildClickGuard(gate: ClickGate) {
  return (event: MouseEvent) => {
    if (!gate.swallow) return;
    gate.swallow = false;
    event.preventDefault();
    event.stopPropagation();
  };
}

/**
 * Drives the drag session from pointer events on the container. No-op on native,
 * where the RNGH pan in `useFileTreeDrag` handles it.
 */
export function useFileTreeDragWeb({ enabled, containerRef, session }: FileTreeDragWebParams): void {
  const gate = useRef<ClickGate>({ swallow: false }).current;

  // biome-ignore lint/plugin: pointer capture is an external side effect that must be bound on the host node — RNW's responder system cannot express "capture on the scroll container, not the pressed row".
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    // biome-ignore lint/plugin: on web RNW renders the View to a DOM element, so the ref is really an HTMLElement; RN's View type can't express that.
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    const listeners = buildPointerListeners(node, session, gate);
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
  }, [enabled, containerRef, session, gate]);

  // Bound separately from the pointer listeners above, and deliberately not
  // rebound when the session changes: the click it swallows lands *after* the
  // commit that changes the session, so this listener has to be the one constant.
  // biome-ignore lint/plugin: same reason — a capture-phase DOM listener on the host node, which RNW's props cannot express.
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    // biome-ignore lint/plugin: on web RNW renders the View to a DOM element, so the ref is really an HTMLElement; RN's View type can't express that.
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    const onClickCapture = buildClickGuard(gate);
    node.addEventListener('click', onClickCapture, true);
    return () => node.removeEventListener('click', onClickCapture, true);
  }, [enabled, containerRef, gate]);
}
