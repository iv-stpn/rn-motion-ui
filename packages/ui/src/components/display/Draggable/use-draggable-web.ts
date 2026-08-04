// Web transport for <Draggable>: the browser's own HTML5 drag.
//
// Riding the platform drag rather than synthesising one from pointer events is
// what makes a <Draggable> droppable on things it knows nothing about — an
// existing `dragover/drop` listener, another window, the OS. `<FileSystem
// onExternalDrop>` receives these with no adapter for exactly that reason.
//
// It has to be wired through the DOM node: react-native-web renders View as a
// div but drops unknown HTML attributes, so `draggable` and `onDragStart` passed
// as JSX props reach nothing (the FileSystem story used to do this by hand).

import { type RefObject, useEffect } from 'react';
import { Platform, type View } from 'react-native';
import type { DragDropEffect, DragTransfer } from './draggable.types';

/**
 * The platform-independent half of a drag, driven by whichever transport is
 * live. Local to the transports rather than public: a consumer drives a drag
 * through props and the handle, not by calling into the session.
 */
export type DraggableSession = {
  /** Lift at a window point with the transfer the platform provided. */
  begin: (x: number, y: number, transfer: DragTransfer) => void;
  move: (x: number, y: number) => void;
  /**
   * End the drag with the platform's verdict on what the drop did. `'none'` is
   * the cancel case — the transport passes what it knows and the session turns
   * that into `onDragEnd`, so neither platform decides what "canceled" means.
   */
  finish: (dropEffect: DragDropEffect, x: number, y: number) => void;
  isDragging: () => boolean;
};

export type UseDraggableWebParams = { enabled: boolean; nodeRef: RefObject<View | null>; session: DraggableSession };

export function useDraggableWeb({ enabled, nodeRef, session }: UseDraggableWebParams): void {
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
      session.begin(e.clientX, e.clientY, e.dataTransfer);
    }

    function onDrag(e: DragEvent) {
      // The last `drag` before `dragend` reports (0, 0) in every engine. Passing
      // it through would snap any consumer's read-out to the top-left corner one
      // frame before the drop.
      if (e.clientX === 0 && e.clientY === 0) return;
      session.move(e.clientX, e.clientY);
    }

    function onDragEnd(e: DragEvent) {
      // The browser's verdict, read off the event rather than the transfer kept
      // at lift time: a drop zone that accepted the payload set its own
      // dropEffect, and anything else — no target, or Escape — leaves 'none'.
      session.finish(e.dataTransfer?.dropEffect ?? 'none', e.clientX, e.clientY);
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
