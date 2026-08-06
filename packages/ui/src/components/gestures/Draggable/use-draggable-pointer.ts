// Web transport #2: a pointer-driven pan, for touch.
//
// No mobile browser starts an HTML5 drag from a finger — `dragstart` simply never
// fires — so without this a `<Draggable>` is inert on every phone and tablet on the
// web, which is half of "works on web and native". The pan is armed by a hold, the
// same 300ms as the native transport, so the gesture feels identical across the two.
//
// Built on pointer events rather than RNGH deliberately: react-native-gesture-handler
// needs a `GestureHandlerRootView` in the consumer's tree to work under
// react-native-web, and the rest of this package refuses to require one (see the
// note in `use-hold-activation.ts`). `FileSystem`'s own web drag is built the same
// way, for the same reason.
//
// One honest limitation: a pan carries the library's own `DragTransfer`, not a real
// `DataTransfer`. A touch drag therefore reaches `<Dragzone>`s and nothing else —
// no `<FileSystem onExternalDrop>`, no other window. The browser gives no way to
// start an OS drag session from a finger, so this is the platform's floor.

import { type RefObject, useEffect, useRef } from 'react';
import { Platform, type View } from 'react-native';
import type { DragEffectAllowed } from '../drag.types';
import { createDragTransfer } from '../drag-transfer';
import { DRAG_HOLD_MS, type DraggableSession } from './draggable-session';

/** Move further than this before the hold lands and it was a scroll, not a lift. */
const ARM_SLOP = 10;

type Trip = { dragging: boolean; pointerId: number; startX: number; startY: number; timer: ReturnType<typeof setTimeout> | null };

function capturePointer(node: HTMLElement, pointerId: number) {
  try {
    node.setPointerCapture(pointerId);
  } catch {
    /* synthetic events may throw */
  }
}

type ListenerParams = { effectAllowed: DragEffectAllowed; node: HTMLElement; session: DraggableSession };

function buildListeners({ effectAllowed, node, session }: ListenerParams) {
  let trip: Trip | null = null;

  function reset() {
    if (trip !== null && trip.timer !== null) clearTimeout(trip.timer);
    trip = null;
  }

  function onPointerDown(e: PointerEvent) {
    // Touch only. A mouse on this same element is the HTML5 transport's business,
    // and arming both would run two drags off one gesture.
    if (trip !== null || e.pointerType !== 'touch') return;
    trip = { dragging: false, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, timer: null };
    trip.timer = setTimeout(() => {
      if (trip === null) return;
      capturePointer(node, trip.pointerId);
      trip.dragging = true;
      session.begin({
        point: { x: trip.startX, y: trip.startY },
        transfer: createDragTransfer(effectAllowed),
        transport: 'pan',
      });
    }, DRAG_HOLD_MS);
  }

  function onPointerMove(e: PointerEvent) {
    if (trip === null || e.pointerId !== trip.pointerId) return;
    if (trip.dragging) {
      // Non-passive, so this is what stops the page scrolling under the drag.
      e.preventDefault();
      session.move({ x: e.clientX, y: e.clientY });
      return;
    }
    // Still waiting on the hold: a finger that travels was scrolling, so let it.
    if (Math.hypot(e.clientX - trip.startX, e.clientY - trip.startY) > ARM_SLOP) reset();
  }

  function onPointerUp(e: PointerEvent) {
    if (trip === null || e.pointerId !== trip.pointerId) return;
    const wasDragging = trip.dragging;
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
   * The scroll block. `preventDefault` on `pointermove` is enough in Chrome, but
   * Safari only honours it on the touch event, so both are needed to stop a drag
   * from scrolling the page under itself.
   */
  function onTouchMove(e: TouchEvent) {
    if (trip?.dragging === true) e.preventDefault();
  }

  return { onPointerAbort, onPointerDown, onPointerMove, onPointerUp, onTouchMove, reset };
}

export type UseDraggablePointerParams = {
  effectAllowed: DragEffectAllowed;
  enabled: boolean;
  nodeRef: RefObject<View | null>;
  session: DraggableSession;
};

export function useDraggablePointer({ effectAllowed, enabled, nodeRef, session }: UseDraggablePointerParams): void {
  // Live, so a changed `effectAllowed` does not rebind the listeners mid-gesture.
  const effectRef = useRef(effectAllowed);
  effectRef.current = effectAllowed;

  // biome-ignore lint/plugin: DOM event wiring must run in an effect; no data-fetching or render-driving state
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    // biome-ignore lint/plugin: RN View refs resolve to HTMLElement in react-native-web
    const node = nodeRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;

    const listeners = buildListeners({ effectAllowed: effectRef.current, node, session });

    node.addEventListener('pointerdown', listeners.onPointerDown);
    node.addEventListener('pointermove', listeners.onPointerMove, { passive: false });
    node.addEventListener('pointerup', listeners.onPointerUp);
    node.addEventListener('pointercancel', listeners.onPointerAbort);
    node.addEventListener('lostpointercapture', listeners.onPointerAbort);
    node.addEventListener('touchmove', listeners.onTouchMove, { passive: false });

    return () => {
      listeners.reset();
      node.removeEventListener('pointerdown', listeners.onPointerDown);
      node.removeEventListener('pointermove', listeners.onPointerMove);
      node.removeEventListener('pointerup', listeners.onPointerUp);
      node.removeEventListener('pointercancel', listeners.onPointerAbort);
      node.removeEventListener('lostpointercapture', listeners.onPointerAbort);
      node.removeEventListener('touchmove', listeners.onTouchMove);
    };
  }, [enabled, nodeRef, session]);
}
