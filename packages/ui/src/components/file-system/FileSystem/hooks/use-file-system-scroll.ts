// The scroll-offset contract between <FileSystem> and its consumers: views
// report their vertical offset through `reportScrollOffset` (call it from the
// view's own onScroll handler) and apply `initialScrollOffset` when they mount
// or whenever the consumer changes it.
//
// Why the retry: a view's container is empty on first mount — children load
// asynchronously — so a `scrollTo` fired there clamps to zero. The view calls
// `retryPendingScroll` from its `onContentSizeChange`, and the pending offset
// lands once real content exists. The pending offset also re-arms whenever the
// consumer changes `initialScrollOffset`, so a later "jump to position" (URL
// adoption, sidebar reset to top) applies even if the container had no content
// at the moment the value arrived.

import { useCallback, useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { useFileSystemConsumer, useFileSystemStoreContext } from '../store/file-system-context';

export function useFileSystemScroll(applyScrollTo: (offset: number) => void) {
  const consumer = useFileSystemConsumer();
  const setScrollOffset = useStore(useFileSystemStoreContext(), (state) => state.setScrollOffset);

  const applyRef = useRef(applyScrollTo);
  applyRef.current = applyScrollTo;

  const pendingOffsetRef = useRef<number | null>(null);

  // Apply on mount and whenever the consumer changes the offset. The ref keeps
  // the value even when the container cannot take it yet — `retryPendingScroll`
  // consumes it once content exists.
  // biome-ignore lint/plugin: applying an external position record to the scroll container is a genuine effect — the consumer's offset is store state, not render data
  useEffect(() => {
    const target = consumer.initialScrollOffset ?? 0;
    pendingOffsetRef.current = target;
    if (target > 0) applyRef.current(target);
  }, [consumer.initialScrollOffset]);

  const retryPendingScroll = useCallback(() => {
    const target = pendingOffsetRef.current;
    if (target === null || target <= 0) return;
    pendingOffsetRef.current = null;
    applyRef.current(target);
  }, []);

  const reportScrollOffset = useCallback((offset: number) => setScrollOffset(offset), [setScrollOffset]);

  return { retryPendingScroll, reportScrollOffset };
}
