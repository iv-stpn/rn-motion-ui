// Keeping zone boxes honest on web, where they move without React hearing about it.
//
// A hit test is only as good as the rects it runs against, and on web two things
// move a box with no layout pass and no re-render: a scroll and a window resize.
// Native has neither problem in this form — a `ScrollView` cannot notify the window,
// so zones there re-measure from their own `onLayout` and at lift time instead.
//
// Scroll is listened for in the capture phase because scroll events do not bubble:
// only capture at the window sees a scroll inside some nested container, which is
// exactly the case that moves a zone without moving the page.

import { useEffect } from 'react';
import { Platform } from 'react-native';
import { getActiveDrag, refreshDragzones } from '../drag-store';

/** How long the boxes may be stale after a scroll settles. One frame at 60Hz, near enough. */
const SETTLE_MS = 16;

/**
 * Re-measure every zone after a scroll or resize, while enabled.
 *
 * Coalesced on a timer rather than run per event: a scroll fires far faster than a
 * measure round-trip completes, and measuring per event would queue work that is
 * already obsolete by the time it resolves.
 */
export function useZoneRemeasure(enabled: boolean): void {
  // biome-ignore lint/plugin: window event wiring must run in an effect; no data-fetching or render-driving state
  useEffect(() => {
    const win = globalThis.window;
    if (Platform.OS !== 'web' || !enabled || typeof win === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function schedule() {
      // Nothing in flight means nothing is reading the rects, and the next lift
      // re-measures anyway — so an idle page does no work here at all.
      if (getActiveDrag() === null) return;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        refreshDragzones().catch(() => undefined);
      }, SETTLE_MS);
    }

    win.addEventListener('scroll', schedule, { capture: true, passive: true });
    win.addEventListener('resize', schedule, { passive: true });

    return () => {
      if (timer !== null) clearTimeout(timer);
      win.removeEventListener('scroll', schedule, { capture: true });
      win.removeEventListener('resize', schedule);
    };
  }, [enabled]);
}
