// Web transport #2: a pointer-driven pan, for touch (and for mouse when `cursorMode`).
//
// No mobile browser starts an HTML5 drag from a finger — `dragstart` simply never
// fires — so without this a `<Draggable>` is inert on every phone and tablet on the
// web, which is half of "works on web and native". The phases are the native
// transport's, on the same resolved tuning, so the gesture feels identical across
// the two: movement before `armDelay` belongs to the page's scroll, movement after
// it lifts, and a press that reaches `holdDelay` without moving is a hold instead.
//
// Except that on web `holdDelay` defaults to `null`, so the third phase does not
// exist unless a consumer asks for it — a long press in a browser already means the
// context menu or a text selection. See `resolveDragBehavior`.
//
// Touch only by default: a mouse on this same element is the HTML5 transport's
// business, and arming both would run two drags off one gesture. `cursorMode` opts
// in to mouse left-button presses here — when set, this transport handles both hold
// and drag from a mouse, and the HTML5 transport is disabled to avoid a conflict.
//
// Built on pointer events rather than RNGH deliberately: react-native-gesture-handler
// needs a `GestureHandlerRootView` in the consumer's tree to work under
// react-native-web, and the rest of this package refuses to require one.
// `FileSystem`'s own web drag is built the same way, for the same reason.
//
// One honest limitation: a pan carries the library's own `DragTransfer`, not a real
// `DataTransfer`. A touch drag therefore reaches `<Dragzone>`s and nothing else —
// no `<FileSystem onExternalDrop>`, no other window. The browser gives no way to
// start an OS drag session from a finger, so this is the platform's floor.

import { type RefObject, useEffect, useRef } from 'react';
import { Platform, type View } from 'react-native';
import type { DragEffectAllowed } from '../drag.types';
import { createDragTransfer } from '../drag-transfer';
import type { PressTimeline } from '../use-press-timeline';
import type { DraggableSession } from './draggable-session';

type Trip = { dragging: boolean; pointerId: number; startX: number; startY: number };

function capturePointer(node: HTMLElement, pointerId: number) {
  try {
    node.setPointerCapture(pointerId);
  } catch {
    /* synthetic events may throw */
  }
}

type ListenerParams = {
  /**
   * When true, a mouse left-button press runs the same timeline a touch press
   * does — hold fires at `holdDelay`, and a drag past `slop` lifts through
   * this transport instead of HTML5. Right-click is never intercepted.
   */
  cursorMode: boolean;
  effectAllowed: DragEffectAllowed;
  node: HTMLElement;
  session: DraggableSession;
  /**
   * Drives the press timeline — the same instance the native pan drives.
   *
   * Thresholds are owned by the timeline internally, so they never need to be
   * passed here separately; the listeners call `timeline.move(travel)` and act
   * on the returned outcome.
   */
  timeline: PressTimeline;
};

function buildListeners({ cursorMode, effectAllowed, node, session, timeline }: ListenerParams) {
  let trip: Trip | null = null;
  // Set at `pointerup` when the press had reached `'hold'`, read at the
  // `touchend` that follows it — see `onTouchEnd`, and at the `click` listener
  // for mouse-mode. `pointerup` arrives first and ends the timeline, so the
  // phase has to be carried across the gap.
  let holdReleased = false;

  function acceptsPointer(e: PointerEvent): boolean {
    if (e.pointerType === 'touch') return true;
    // A mouse — right-click is never a hold: button 2 must still open the
    // browser's own context menu. `e.button` on pointerdown for button 2 is 2.
    return cursorMode && e.pointerType === 'mouse' && e.button === 0;
  }

  function reset() {
    trip = null;
    timeline.end();
  }

  function onPointerDown(e: PointerEvent) {
    if (trip !== null || !acceptsPointer(e)) return;
    trip = { dragging: false, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY };
    timeline.press();
  }

  function onPointerMove(e: PointerEvent) {
    if (trip === null || e.pointerId !== trip.pointerId) return;
    if (trip.dragging) {
      // Non-passive, so this is what stops the page scrolling under the drag.
      e.preventDefault();
      session.move({ x: e.clientX, y: e.clientY });
      return;
    }
    const travel = Math.hypot(e.clientX - trip.startX, e.clientY - trip.startY);
    // The timeline already encodes the phase (pending → active → hold), so a
    // single `move` call resolves the right threshold for the current moment:
    // scrolled in `pending`, slop-lifted in `active`, escape-slop-lifted in `hold`.
    const outcome = timeline.move(travel);
    if (outcome === 'scrolled') {
      reset();
      return;
    }
    if (outcome !== 'lift') return;
    // Armed and now moving past the threshold: this is the lift. Capturing here
    // rather than at the press keeps a bare hold's events on the node they started
    // on, so the press responder above still sees the gesture it is timing.
    e.preventDefault();
    capturePointer(node, trip.pointerId);
    trip.dragging = true;
    // Before session.begin, so a menu the hold opened is on its way out in the
    // same batch the ghost appears in — and a hold still pending never fires
    // behind a drag that has already started.
    timeline.lift();
    session.begin({
      point: { x: e.clientX, y: e.clientY },
      transfer: createDragTransfer(effectAllowed),
      transport: 'pan',
    });
  }

  function onPointerUp(e: PointerEvent) {
    if (trip === null || e.pointerId !== trip.pointerId) return;
    const wasDragging = trip.dragging;
    holdReleased = timeline.phase.current === 'hold';
    reset();
    if (wasDragging) session.finish({ commit: true, point: { x: e.clientX, y: e.clientY } });
  }

  function onPointerAbort(e: PointerEvent) {
    if (trip === null || e.pointerId !== trip.pointerId) return;
    const wasDragging = trip.dragging;
    reset();
    // Taken away by the system — a scroll won, the node unmounted. `pointerup`
    // does not follow, so this is the only place the drag can be ended.
    if (wasDragging) session.finish({ commit: false, point: { x: e.clientX, y: e.clientY } });
  }

  /**
   * `lostpointercapture` bubbles — and the lift *causes* one: taking explicit
   * capture on this node releases the touch's implicit capture on the child the
   * finger actually landed on, and that event rises through here. Treating it
   * as an abort makes the transport kill its own drag one move after lifting
   * it. Only a loss on the captured node itself, mid-trip, means the system
   * took the pointer.
   */
  function onLostCapture(e: PointerEvent) {
    if (e.target !== node) return;
    onPointerAbort(e);
  }

  /**
   * The scroll block. `preventDefault` on `pointermove` is enough in Chrome, but
   * Safari only honours it on the touch event, so both are needed to stop a drag
   * from scrolling the page under itself.
   *
   * Also held from the moment a hold fires, not just once a drag lifts: the
   * escape's first moves arrive *before* `trip.dragging` flips, and leaving them
   * unprevented lets the browser read the touch as a scroll and fire
   * `pointercancel` — which kills the drag one beat after it lifted. A fired
   * hold has claimed the gesture; nothing should scroll under it.
   */
  function onTouchMove(e: TouchEvent) {
    if (trip === null) return;
    if (trip.dragging || timeline.phase.current === 'hold') e.preventDefault();
  }

  /**
   * A hold that fired must not also click. The browser synthesizes
   * `mousedown`/`click` at the release point after `touchend` — and with a menu
   * open, the topmost element there is the menu's own scrim, so the phantom
   * click dismisses the menu the instant the finger lifts. Cancelling the
   * `touchend` is the one documented way to suppress the compat events.
   */
  function onTouchEnd(e: TouchEvent) {
    if (!holdReleased) return;
    holdReleased = false;
    e.preventDefault();
  }

  /**
   * Mouse-mode equivalent of `onTouchEnd`: a mouse left-button release after a
   * hold fires a real `click` event, and whatever the hold opened would see it
   * as a dismissal. Capture-phase to stop it before any other handler.
   */
  function onClick(e: MouseEvent) {
    if (!holdReleased) return;
    holdReleased = false;
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  return { onClick, onLostCapture, onPointerAbort, onPointerDown, onPointerMove, onPointerUp, onTouchEnd, onTouchMove, reset };
}

export type UseDraggablePointerParams = {
  /** When true, a mouse left-button press runs the same timeline a touch press does. */
  cursorMode: boolean;
  effectAllowed: DragEffectAllowed;
  enabled: boolean;
  nodeRef: RefObject<View | null>;
  session: DraggableSession;
  /** Stable across renders, so listing it as a dependency does not rebind anything. */
  timeline: PressTimeline;
};

export function useDraggablePointer({
  cursorMode,
  effectAllowed,
  enabled,
  nodeRef,
  session,
  timeline,
}: UseDraggablePointerParams): void {
  // Live, so a changed `effectAllowed` does not rebind the listeners mid-gesture.
  const effectRef = useRef(effectAllowed);
  effectRef.current = effectAllowed;

  // biome-ignore lint/plugin: DOM event wiring must run in an effect; no data-fetching or render-driving state
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    // biome-ignore lint/plugin: RN View refs resolve to HTMLElement in react-native-web
    const node = nodeRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;

    const listeners = buildListeners({ cursorMode, effectAllowed: effectRef.current, node, session, timeline });

    node.addEventListener('pointerdown', listeners.onPointerDown);
    node.addEventListener('pointermove', listeners.onPointerMove, { passive: false });
    node.addEventListener('pointerup', listeners.onPointerUp);
    node.addEventListener('pointercancel', listeners.onPointerAbort);
    node.addEventListener('lostpointercapture', listeners.onLostCapture);
    node.addEventListener('touchmove', listeners.onTouchMove, { passive: false });
    node.addEventListener('touchend', listeners.onTouchEnd, { passive: false });
    // A capture-phase click listener on a `draggable` element blocks Safari from
    // starting a native drag — the browser reads it as the element being
    // interactive and refuses the lift. Only needed for mouse-mode hold
    // suppression, so it is only added when cursorMode is on.
    if (cursorMode) node.addEventListener('click', listeners.onClick, { capture: true });

    return () => {
      listeners.reset();
      node.removeEventListener('pointerdown', listeners.onPointerDown);
      node.removeEventListener('pointermove', listeners.onPointerMove);
      node.removeEventListener('pointerup', listeners.onPointerUp);
      node.removeEventListener('pointercancel', listeners.onPointerAbort);
      node.removeEventListener('lostpointercapture', listeners.onLostCapture);
      node.removeEventListener('touchmove', listeners.onTouchMove);
      node.removeEventListener('touchend', listeners.onTouchEnd);
      if (cursorMode) node.removeEventListener('click', listeners.onClick, { capture: true });
    };
    // `timeline` is stable for the life of the component, so it never rebinds here.
  }, [cursorMode, enabled, nodeRef, session, timeline]);
}
