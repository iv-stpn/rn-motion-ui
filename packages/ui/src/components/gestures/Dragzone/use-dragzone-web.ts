// The zone's DOM half: claiming the browser's drag, and receiving foreign payloads.
//
// Two jobs, and only the second one carries data.
//
//  1. Claim an in-library HTML5 drag. `preventDefault` on `dragover` is the only
//     way to tell the browser a drop is allowed here — without it the cursor shows
//     "no drop", the page navigates on release, and `dropEffect` at `dragend`
//     reports `'none'` however plainly the drag landed. It delivers no payload:
//     hit testing and `onDrop` for our own drags run off measured rects in the
//     store, on both platforms, so that a native drag and a web drag resolve the
//     same way.
//
//  2. Receive a genuinely external payload — an OS file drag, another tab, another
//     application. There the browser is the only witness that the drop happened
//     here at all, so this hook is where those land.
//
// Hover for an external drag is tracked locally rather than in the store: the store
// describes a drag it saw start, and it has no source, groups or origin for one that
// came from outside the page. The zone merges the flag this returns into its own
// visual state, and `onDrop` is the one callback an external payload reaches.

import { type RefObject, useEffect, useRef, useState } from 'react';
import { Platform, type View } from 'react-native';
import type { DragDropEffect } from '../drag.types';
import { canZoneAcceptExternal, deliverExternalDrop, getActiveDrag } from '../drag-store';

export type UseDragzoneWebParams = {
  acceptsExternal: boolean;
  /** Skips the wiring entirely — a disabled zone should not claim a drag at all. */
  enabled: boolean;
  nodeRef: RefObject<View | null>;
  zoneId: string;
};

/** Whether a foreign drag is currently over this zone. Always `false` off the web. */
export function useDragzoneWeb({ acceptsExternal, enabled, nodeRef, zoneId }: UseDragzoneWebParams): boolean {
  const [externalOver, setExternalOver] = useState(false);
  // `dragenter`/`dragleave` fire for descendants too, so a zone with children would
  // otherwise read "left" the moment the pointer crossed into one of them.
  const depthRef = useRef(0);

  // biome-ignore lint/plugin: DOM event wiring must run in an effect; no data-fetching or render-driving state
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    // biome-ignore lint/plugin: RN View refs resolve to HTMLElement in react-native-web
    const node = nodeRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;

    /** The effect to claim the drag with, or `null` to leave it unclaimed. */
    function claim(e: DragEvent): DragDropEffect | null {
      const transfer = e.dataTransfer;
      if (!transfer) return null;
      const point = { x: e.clientX, y: e.clientY };
      // Ours: the store already ran groups, isolation and `accepts` against real
      // coordinates, so re-deciding here could only disagree with itself.
      if (getActiveDrag() !== null) return transfer.dropEffect === 'none' ? 'copy' : transfer.dropEffect;
      if (!acceptsExternal) return null;
      return canZoneAcceptExternal({ point, transfer, zoneId }) ? 'copy' : null;
    }

    function onDragEnter(e: DragEvent) {
      depthRef.current += 1;
      if (getActiveDrag() !== null) return;
      if (claim(e) !== null) setExternalOver(true);
    }

    function onDragOver(e: DragEvent) {
      const effect = claim(e);
      if (effect === null) return;
      // Both calls matter: the first allows the drop, the second is what `dragend`
      // on the source reads back to tell a drop from a cancel.
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = effect;
    }

    function onDragLeave() {
      depthRef.current = Math.max(0, depthRef.current - 1);
      if (depthRef.current === 0) setExternalOver(false);
    }

    function onDrop(e: DragEvent) {
      depthRef.current = 0;
      setExternalOver(false);
      const transfer = e.dataTransfer;
      // One of ours: the source's `dragend` delivers it through the store, and
      // handling it here as well would hand the zone the same payload twice.
      if (getActiveDrag() !== null || !transfer) return;
      if (!acceptsExternal) return;
      const point = { x: e.clientX, y: e.clientY };
      if (!canZoneAcceptExternal({ point, transfer, zoneId })) return;
      // Only once we know it is ours to take: an unclaimed file drop should still
      // fall through to whatever the browser would have done with it.
      e.preventDefault();
      deliverExternalDrop({ files: [...(transfer.files ?? [])], point, transfer, zoneId });
    }

    node.addEventListener('dragenter', onDragEnter);
    node.addEventListener('dragover', onDragOver);
    node.addEventListener('dragleave', onDragLeave);
    node.addEventListener('drop', onDrop);

    return () => {
      depthRef.current = 0;
      node.removeEventListener('dragenter', onDragEnter);
      node.removeEventListener('dragover', onDragOver);
      node.removeEventListener('dragleave', onDragLeave);
      node.removeEventListener('drop', onDrop);
    };
  }, [acceptsExternal, enabled, nodeRef, zoneId]);

  return externalOver;
}
