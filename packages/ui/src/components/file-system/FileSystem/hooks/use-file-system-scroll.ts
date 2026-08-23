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
//
// Why the last-reported fallback: a view's content can unmount and remount
// without the consumer changing anything — e.g. the FileSystem sits inside a
// container that flips `display: none` (a hidden tab pane) and back. The
// browser clamps `scrollTop` to 0 the moment the content disappears, so the
// position the user actually had is gone from the DOM; it lives only in the
// store the view reported into. `retryPendingScroll` falls back to that last
// reported offset once the content is back, making the view self-restoring —
// a content remount re-applies the position the user last had, with no
// consumer involvement.

import { useCallback, useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { useFileSystemConsumer, useFileSystemStoreContext } from '../store/file-system-context';

export function useFileSystemScroll(applyScrollTo: (offset: number) => void) {
  const consumer = useFileSystemConsumer();
  const setScrollOffset = useStore(useFileSystemStoreContext(), (state) => state.setScrollOffset);

  const applyRef = useRef(applyScrollTo);
  applyRef.current = applyScrollTo;

  const pendingOffsetRef = useRef<number | null>(null);
  // The last offset the view reported (live scrolls). Never the restore source
  // while a pending initial offset is un-consumed — the consumer's explicit
  // value wins. Once the initial offset has been applied (or was 0), content
  // remounts restore from here.
  const lastReportedOffsetRef = useRef(0);

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
    // The initial offset applies at most once (the first time content exists).
    // Consume it even when it is 0 so later retries fall back to the view's
    // own last reported position instead of being blocked by a pending 0.
    const pending = pendingOffsetRef.current;
    pendingOffsetRef.current = null;
    const target = pending ?? lastReportedOffsetRef.current;
    if (target <= 0) return;
    applyRef.current(target);
  }, []);

  const reportScrollOffset = useCallback(
    (offset: number) => {
      lastReportedOffsetRef.current = offset;
      setScrollOffset(offset);
    },
    [setScrollOffset],
  );

  return { retryPendingScroll, reportScrollOffset };
}
