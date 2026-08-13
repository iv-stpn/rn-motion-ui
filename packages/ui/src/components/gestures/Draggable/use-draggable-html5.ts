// Web transport #1: the browser's own HTML5 drag, for a mouse.
//
// Riding the platform drag rather than synthesising one from pointer events is
// what makes a `<Draggable>` droppable on things it knows nothing about — an
// existing `dragover`/`drop` listener, another window, the OS. `<FileSystem
// onExternalDrop>` receives these with no adapter for exactly that reason, and it
// is also what lets a payload leave the page entirely.
//
// It has to be wired through the DOM node: react-native-web renders View as a div
// but drops unknown HTML attributes, so `draggable` and `onDragStart` passed as
// JSX props reach nothing.
//
// Touch is the pan's (`use-draggable-pointer.ts`) — but it can knock on this door:
// Chromium starts a *native* drag from a touch long-press on any `draggable=true`
// element, and the moment it does, the pointer stream gets a `pointercancel` that
// kills the pan mid-gesture. `onDragStart` below refuses that drag outright.

import { type RefObject, useEffect } from 'react';
import { Platform, type View } from 'react-native';
import type { PressTimeline } from '../use-press-timeline';
import type { DraggableSession } from './draggable-session';

/**
 * HTML5 drag image set from the preview React element.
 *
 * The browser draws its own drag image by default (a semi-transparent snapshot of
 * the dragged element), but when a consumer passes a custom `preview` — a chip
 * naming the count rather than a full row — that is what should appear under the
 * cursor. We clone the offscreen DOM node the component keeps rendered, append it
 * to `<body>` so every engine can capture it, call `setDragImage`, and remove the
 * clone on the next microtask.
 */
function setDragImageFromRef(dataTransfer: DataTransfer, previewRef: RefObject<View | null>): void {
  // biome-ignore lint/plugin: RN View refs resolve to HTMLElement in react-native-web
  const source = previewRef.current as unknown as HTMLElement | null;
  if (!source?.isConnected) return;

  // biome-ignore lint/plugin: cloneNode returns Node, but we only clone HTMLElements
  const image = source.cloneNode(true) as HTMLElement;
  image.style.opacity = '1';
  image.style.position = 'fixed';
  image.style.left = '-9999px';
  image.style.top = '0';
  document.body.appendChild(image);
  dataTransfer.setDragImage(image, 0, 0);
  setTimeout(() => image.remove(), 0);
}

/** A 1×1 transparent GIF — used as the drag image to hide the browser's native ghost. */
const EMPTY_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * The image `setDragImage` draws, pre-loaded once for the whole page.
 *
 * The engine snapshots the drag image only *after* the `dragstart` handler returns,
 * so the element handed to `setDragImage` must already be decoded by then. An
 * `<img>` created inside the handler has no dimensions yet on its first use — its
 * data-URI decode is still pending — and a drag image the engine cannot produce
 * aborts the whole drag, which reads as "the first drag dies instantly and every
 * later one works" once the decode is cached. Loading once, before any drag, makes
 * the first drag behave like the rest. A single shared element is fine: the engine
 * snapshots its bitmap, not a live DOM position.
 */
let emptyDragImage: HTMLImageElement | null = null;

function getEmptyDragImage(): HTMLImageElement {
  if (emptyDragImage === null) {
    emptyDragImage = document.createElement('img');
    emptyDragImage.src = EMPTY_IMAGE;
  }
  return emptyDragImage;
}

// Kick the decode off at module load rather than on the first `dragstart` — that
// first handler is the one drag we cannot afford to lose. Guarded because this
// module is also imported on native, where `document` does not exist.
if (typeof document !== 'undefined') getEmptyDragImage();

export type UseDraggableHtml5Params = {
  enabled: boolean;
  nodeRef: RefObject<View | null>;
  /**
   * When non-null, a `<DragManager>` above this source will draw the ghost in its
   * overlay, so the browser's own drag image must be hidden to prevent a double ghost
   * and to keep the ghost position under our control (Safari snaps the native image
   * back to the lift point when the cursor leaves the window).
   */
  overlayHostId: string | null;
  /** When set, the preview element that `setDragImage` draws instead of the browser's default screenshot. */
  previewElementRef?: RefObject<View | null>;
  session: DraggableSession;
  /** The pan's press timeline — how a touch-initiated native drag is recognised and refused. */
  timeline: PressTimeline;
};

export function useDraggableHtml5({
  enabled,
  nodeRef,
  overlayHostId,
  previewElementRef,
  session,
  timeline,
}: UseDraggableHtml5Params): void {
  // biome-ignore lint/plugin: DOM event wiring must run in an effect; no data-fetching or render-driving state
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    // biome-ignore lint/plugin: RN View refs resolve to HTMLElement in react-native-web
    const node = nodeRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;

    // Safari fires `drag` events with the grab point when the cursor leaves the
    // browser window — non-zero coordinates that look valid but teleport the ghost
    // back to the lift position.  Tracking the grab lets us reject those events.
    let grab: { x: number; y: number } | null = null;
    let lastPoint: { x: number; y: number } | null = null;

    function onDragStart(e: DragEvent) {
      // A press the timeline is tracking is the pan's gesture — this `dragstart`
      // is Chromium turning a touch long-press into a native drag, and letting
      // it proceed fires the `pointercancel` that kills the pan (and the hold
      // menu riding it). Same for a pan session already up on a hybrid device.
      // Prevented, not just ignored: an unprevented native drag runs — and
      // cancels the pointer stream — whether or not we begin a session for it.
      if (timeline.phase.current !== 'idle' || session.isDragging()) {
        e.preventDefault();
        return;
      }
      // No dataTransfer means no drag to run — bail rather than lift a session
      // whose payload nothing could read.
      if (!e.dataTransfer) return;
      grab = { x: e.clientX, y: e.clientY };
      lastPoint = grab;
      session.begin({ point: grab, transfer: e.dataTransfer, transport: 'html5' });
      // When a DragManager overlay will draw the ghost instead, hide the browser's
      // own drag image so Safari cannot snap it back to the lift point when the
      // cursor leaves the window.  Without an overlay host the browser's image is
      // the only ghost, so keep it.
      if (overlayHostId !== null) e.dataTransfer.setDragImage(getEmptyDragImage(), 0, 0);
      else if (previewElementRef) setDragImageFromRef(e.dataTransfer, previewElementRef);
    }

    function onDrag(e: DragEvent) {
      // The last `drag` before `dragend` reports (0, 0) in every engine. Passing it
      // through would snap the hit test — and any consumer's read-out — to the
      // top-left corner one frame before the drop.
      if (e.clientX === 0 && e.clientY === 0) return;
      // Safari fires `drag` with the grab point when the cursor leaves the window —
      // the browser stops tracking and reports the lift coordinates.  Reject those
      // so the ghost does not snap back to the source position mid-drag.
      // A legitimate return to the exact grab point (step-by-step, not a teleport)
      // still passes because `lastPoint` was already at or near the grab.
      // `grab` is set in `dragstart` before any `drag` fires and cleared only
      // in `dragend` which arrives after the last `drag` — safe to narrow.
      if (
        grab !== null &&
        e.clientX === grab.x &&
        e.clientY === grab.y &&
        lastPoint !== null &&
        (lastPoint.x !== grab.x || lastPoint.y !== grab.y)
      )
        return;
      lastPoint = { x: e.clientX, y: e.clientY };
      session.move({ x: e.clientX, y: e.clientY });
    }

    function onDragEnd(e: DragEvent) {
      // The browser's verdict, read off the event rather than the transfer kept at
      // lift time. A zone of ours claimed the drag in its own `dragover`; anything
      // else that did — or nothing at all — is reported here and nowhere else.
      grab = null;
      lastPoint = null;
      session.finish({
        commit: true,
        point: { x: e.clientX, y: e.clientY },
        transportDropEffect: e.dataTransfer?.dropEffect ?? 'none',
      });
    }

    node.draggable = true;
    node.addEventListener('dragstart', onDragStart);
    node.addEventListener('drag', onDrag);
    node.addEventListener('dragend', onDragEnd);

    return () => {
      node.draggable = false;
      node.removeEventListener('dragstart', onDragStart);
      node.removeEventListener('drag', onDrag);
      node.removeEventListener('dragend', onDragEnd);
    };
    // `timeline`, `previewElementRef` and `overlayHostId` are stable for the life of
    // the component, so they never rebind here.
  }, [enabled, nodeRef, overlayHostId, previewElementRef, session, timeline]);
}
