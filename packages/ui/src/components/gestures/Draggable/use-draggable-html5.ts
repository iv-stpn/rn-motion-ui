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
// Touch never gets here. No mobile browser starts an HTML5 drag from a finger, so
// that case is `use-draggable-pointer.ts` instead.

import { type RefObject, useEffect } from 'react';
import { Platform, type View } from 'react-native';
import type { DraggableSession } from './draggable-session';

export type UseDraggableHtml5Params = { enabled: boolean; nodeRef: RefObject<View | null>; session: DraggableSession };

export function useDraggableHtml5({ enabled, nodeRef, session }: UseDraggableHtml5Params): void {
  // biome-ignore lint/plugin: DOM event wiring must run in an effect; no data-fetching or render-driving state
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    // biome-ignore lint/plugin: RN View refs resolve to HTMLElement in react-native-web
    const node = nodeRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;

    function onDragStart(e: DragEvent) {
      // No dataTransfer means no drag to run — bail rather than lift a session
      // whose payload nothing could read.
      if (!e.dataTransfer) return;
      // A pan already in flight (a touch that armed first on a hybrid device) owns
      // this drag; two transports on one gesture would double every callback.
      if (session.isDragging()) return;
      session.begin({ point: { x: e.clientX, y: e.clientY }, transfer: e.dataTransfer, transport: 'html5' });
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
  }, [enabled, nodeRef, session]);
}
