// Web drag-and-drop transport for FileSystemListView.
//
// Uses pointer-capture on the scroll container so the pointer stream survives
// re-renders that would otherwise cause the captured row node to unmount and
// synthesize a pointercancel. Mirrors use-file-tree-drag-web.ts exactly.
//
// Coordinates: all values passed to session.begin/move are container-local
// (relative to the node's top-left corner). clientX/Y from the DOM events are
// viewport-relative, so we subtract node.getBoundingClientRect() on each event.

import { type RefObject, useEffect, useRef } from 'react';
import type { View } from 'react-native';
import type { FileSystemDragSession } from './use-file-system-drag';

const MOUSE_DRAG_SLOP = 4;
const TOUCH_ARM_SLOP = 10;
const TOUCH_LONG_PRESS_MS = 300;

type PointerTrip = {
  pointerId: number;
  isTouch: boolean;
  startX: number;
  startY: number;
  timer: ReturnType<typeof setTimeout> | null;
  dragging: boolean;
};

/**
 * One bit, shared by the pointer listeners and the click guard: a drag just
 * ended, so swallow the click the browser sends after the release. It has to
 * outlive the listener closures — the guard is bound in its own effect so it
 * survives session rebuilds, and the click it swallows lands after the drop.
 */
type ClickGate = { swallow: boolean };

function capturePointer(node: HTMLElement, pointerId: number) {
  try {
    node.setPointerCapture(pointerId);
  } catch {
    /* synthetic events may throw */
  }
}

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

type LocalPoint = { x: number; y: number };

/** Convert a viewport-relative clientX/Y to container-local coordinates. */
function toLocal(node: HTMLElement, clientX: number, clientY: number): LocalPoint {
  const rect = node.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function buildPointerListeners(node: HTMLElement, session: FileSystemDragSession, gate: ClickGate) {
  let trip: PointerTrip | null = null;

  function reset() {
    if (trip !== null && trip.timer !== null) clearTimeout(trip.timer);
    trip = null;
  }

  function onPointerDown(e: PointerEvent) {
    // Stale suppression can't outlive the next press (a drag whose click never came).
    gate.swallow = false;
    // One pointer, primary button only — right-click still reaches the context menu.
    if (trip !== null || e.button !== 0 || isTextEntry(e.target)) return;
    const { x, y } = toLocal(node, e.clientX, e.clientY);
    const isTouch = e.pointerType === 'touch';
    trip = { pointerId: e.pointerId, isTouch, startX: x, startY: y, timer: null, dragging: false };
    if (isTouch)
      trip.timer = setTimeout(() => {
        if (!trip) return;
        capturePointer(node, trip.pointerId);
        if (session.begin(trip.startX, trip.startY)) {
          trip.dragging = true;
          gate.swallow = false;
        } else reset();
      }, TOUCH_LONG_PRESS_MS);
  }

  function onPointerMove(e: PointerEvent) {
    if (!trip || e.pointerId !== trip.pointerId) return;
    const { x, y } = toLocal(node, e.clientX, e.clientY);
    const dx = x - trip.startX;
    const dy = y - trip.startY;
    if (trip.isTouch && !trip.dragging) {
      if (Math.hypot(dx, dy) > TOUCH_ARM_SLOP) reset();
      return;
    }
    if (!trip.dragging) {
      if (Math.hypot(dx, dy) < MOUSE_DRAG_SLOP) return;
      capturePointer(node, trip.pointerId);
      if (!session.begin(trip.startX, trip.startY)) {
        reset();
        return;
      }
      trip.dragging = true;
      gate.swallow = false;
    }
    e.preventDefault();
    session.move(x, y);
  }

  function onPointerUp(e: PointerEvent) {
    if (!trip || e.pointerId !== trip.pointerId) return;
    const wasDragging = trip.dragging;
    reset();
    if (wasDragging) {
      gate.swallow = true;
      session.finish(true);
    }
  }

  function onPointerAbort(e: PointerEvent) {
    if (!trip || e.pointerId !== trip.pointerId) return;
    const wasDragging = trip.dragging;
    reset();
    if (wasDragging) session.finish(false);
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerAbort, reset };
}

function buildClickGuard(gate: ClickGate) {
  return (e: MouseEvent) => {
    if (!gate.swallow) return;
    gate.swallow = false;
    e.stopPropagation();
    e.preventDefault();
  };
}

export type UseFileSystemDragWebParams = {
  enabled: boolean;
  containerRef: RefObject<View | null>;
  session: FileSystemDragSession;
};

export function useFileSystemDragWeb({ enabled, containerRef, session }: UseFileSystemDragWebParams): void {
  // One gate for both effects: the pointer listeners set the bit on release and
  // the click guard clears it. Two separate objects would mean the guard never
  // sees the flag, and the post-drop click would select or open the drop target.
  const gate = useRef<ClickGate>({ swallow: false }).current;

  // biome-ignore lint/plugin: DOM event wiring must run in an effect; no data-fetching or render-driving state
  useEffect(() => {
    if (!enabled) return;
    // biome-ignore lint/plugin: RN View refs resolve to HTMLElement in react-native-web
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    const { onPointerDown, onPointerMove, onPointerUp, onPointerAbort, reset } = buildPointerListeners(node, session, gate);

    node.addEventListener('pointerdown', onPointerDown);
    node.addEventListener('pointermove', onPointerMove, { passive: false });
    node.addEventListener('pointerup', onPointerUp);
    node.addEventListener('pointercancel', onPointerAbort);
    node.addEventListener('lostpointercapture', onPointerAbort);

    return () => {
      reset();
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('pointermove', onPointerMove);
      node.removeEventListener('pointerup', onPointerUp);
      node.removeEventListener('pointercancel', onPointerAbort);
      node.removeEventListener('lostpointercapture', onPointerAbort);
    };
  }, [enabled, containerRef, gate, session]);

  // Click guard — separate effect so it outlives session rebuilds. The click it
  // swallows lands after the release that set the bit, so the two never race.
  // biome-ignore lint/plugin: DOM event wiring must run in an effect; no data-fetching or render-driving state
  useEffect(() => {
    if (!enabled) return;
    // biome-ignore lint/plugin: RN View refs resolve to HTMLElement in react-native-web
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    const guard = buildClickGuard(gate);
    node.addEventListener('click', guard, true);
    return () => node.removeEventListener('click', guard, true);
  }, [enabled, containerRef, gate]);
}
