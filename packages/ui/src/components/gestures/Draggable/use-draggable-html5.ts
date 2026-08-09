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

export type UseDraggableHtml5Params = {
  enabled: boolean;
  nodeRef: RefObject<View | null>;
  /** When set, the preview element that `setDragImage` draws instead of the browser's default screenshot. */
  previewElementRef?: RefObject<View | null>;
  session: DraggableSession;
  /** The pan's press timeline — how a touch-initiated native drag is recognised and refused. */
  timeline: PressTimeline;
};

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

export function useDraggableHtml5({ enabled, nodeRef, previewElementRef, session, timeline }: UseDraggableHtml5Params): void {
  // biome-ignore lint/plugin: DOM event wiring must run in an effect; no data-fetching or render-driving state
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    // biome-ignore lint/plugin: RN View refs resolve to HTMLElement in react-native-web
    const node = nodeRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;

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
      session.begin({ point: { x: e.clientX, y: e.clientY }, transfer: e.dataTransfer, transport: 'html5' });
      if (previewElementRef) setDragImageFromRef(e.dataTransfer, previewElementRef);
    }

    function onDrag(e: DragEvent) {
      // The last `drag` before `dragend` reports (0, 0) in every engine. Passing it
      // through would snap the hit test — and any consumer's read-out — to the
      // top-left corner one frame before the drop.
      if (e.clientX === 0 && e.clientY === 0) return;
      session.move({ x: e.clientX, y: e.clientY });
    }

    function onDragEnd(e: DragEvent) {
      // The browser's verdict, read off the event rather than the transfer kept at
      // lift time. A zone of ours claimed the drag in its own `dragover`; anything
      // else that did — or nothing at all — is reported here and nowhere else.
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
    // `timeline` and `previewElementRef` are stable for the life of the component,
    // so they never rebind here.
  }, [enabled, nodeRef, previewElementRef, session, timeline]);
}
