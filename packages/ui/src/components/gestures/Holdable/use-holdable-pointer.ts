// The web press observer: pointer events, touch only.
//
// Touch only, and that is the design rather than a gap. A mouse held still for
// 300ms is not a gesture anybody makes on purpose — the right button is what means
// "tell me about this thing" on a desktop — and a hold layered onto a held left
// button fights text selection. So a `<Holdable>` on a desktop browser reports
// nothing, and the hold on a *phone's* browser is what this is for: the one platform
// with no right button to fall back on. `use-draggable-pointer.ts` filters the same
// way, for the same reason.
//
// Nothing here calls `preventDefault` on a move, which is the difference between
// this and the draggable pointer transport: a `<Holdable>` must never stop the page
// scrolling under it. When a scroll does start, the browser takes the pointer away
// and fires `pointercancel` — which ends the press, exactly as a scroll should.

import { type RefObject, useEffect } from 'react';
import { Platform, type View } from 'react-native';
import type { PressTimeline } from '../use-press-timeline';

type Trip = { pointerId: number; startX: number; startY: number };

type ListenerParams = {
  node: HTMLElement;
  /**
   * Carries its own thresholds, so nothing here reads a `DragTuning` at all: the
   * listeners hand it a raw distance and it answers against the phase it is in. Which
   * is also why retuning a live surface needs no rebind — the timeline reads the new
   * numbers off a ref on the next press.
   */
  timeline: PressTimeline;
};

function buildListeners({ node, timeline }: ListenerParams) {
  let trip: Trip | null = null;
  // Set at `pointerup` when the press had reached `'hold'`, read at the
  // `touchend` that follows it — see `onTouchEnd`. `pointerup` arrives first
  // and ends the timeline, so the phase has to be carried across the gap.
  let holdReleased = false;

  function end() {
    trip = null;
    timeline.end();
  }

  function onPointerDown(e: PointerEvent) {
    if (trip !== null || e.pointerType !== 'touch') return;
    trip = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY };
    timeline.press();
  }

  function onPointerMove(e: PointerEvent) {
    if (trip === null || e.pointerId !== trip.pointerId) return;
    const travel = Math.hypot(e.clientX - trip.startX, e.clientY - trip.startY);
    // `'lift'` is unreachable — the timeline is built with `canDrag: false` for a
    // bare `<Holdable>` — so the only outcome that acts is the scroll's claim on the
    // press before it armed, and the shove off it afterwards.
    if (timeline.move(travel) === 'scrolled') end();
  }

  function onPointerEnd(e: PointerEvent) {
    if (trip === null || e.pointerId !== trip.pointerId) return;
    // Only a released finger clicks — a cancelled pointer produces no compat
    // events, so the flag must not be armed for one it can never clear on.
    if (e.type === 'pointerup') holdReleased = timeline.phase.current === 'hold';
    end();
  }

  /**
   * A hold that fired must not also click. The browser synthesizes
   * `mousedown`/`click` at the release point after `touchend`, and whatever the
   * hold put on screen — `HoldContextMenu`'s scrim sits exactly there — takes
   * that phantom click as a dismissal the instant the finger lifts. Cancelling
   * the `touchend` is the one documented way to suppress the compat events.
   */
  function onTouchEnd(e: TouchEvent) {
    if (!holdReleased) return;
    holdReleased = false;
    e.preventDefault();
  }

  /**
   * Chrome on Android raises `contextmenu` for a touch long press at ~500ms, which
   * would put the browser's own menu on top of whatever the hold just opened. Only
   * cancelled while a touch press is in flight: a right-click never reaches `trip`
   * (the pointer filter above drops it), so a consumer's own context menu — and
   * `HoldContextMenu`'s web activation, which is a right-click — still works.
   */
  function onContextMenu(e: Event) {
    if (trip !== null) e.preventDefault();
  }

  node.addEventListener('pointerdown', onPointerDown);
  node.addEventListener('pointermove', onPointerMove);
  node.addEventListener('pointerup', onPointerEnd);
  node.addEventListener('pointercancel', onPointerEnd);
  node.addEventListener('lostpointercapture', onPointerEnd);
  node.addEventListener('contextmenu', onContextMenu);
  node.addEventListener('touchend', onTouchEnd, { passive: false });

  return () => {
    end();
    node.removeEventListener('pointerdown', onPointerDown);
    node.removeEventListener('pointermove', onPointerMove);
    node.removeEventListener('pointerup', onPointerEnd);
    node.removeEventListener('pointercancel', onPointerEnd);
    node.removeEventListener('lostpointercapture', onPointerEnd);
    node.removeEventListener('contextmenu', onContextMenu);
    node.removeEventListener('touchend', onTouchEnd);
  };
}

export type UseHoldablePointerParams = {
  enabled: boolean;
  nodeRef: RefObject<View | null>;
  /** Stable across renders, so listing it as a dependency does not rebind anything. */
  timeline: PressTimeline;
};

export function useHoldablePointer({ enabled, nodeRef, timeline }: UseHoldablePointerParams): void {
  // biome-ignore lint/plugin: DOM event wiring must run in an effect; no data-fetching or render-driving state
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    // biome-ignore lint/plugin: RN View refs resolve to HTMLElement in react-native-web
    const node = nodeRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    return buildListeners({ node, timeline });
    // `timeline` is stable for the life of the component, so it never rebinds here.
  }, [enabled, nodeRef, timeline]);
}
