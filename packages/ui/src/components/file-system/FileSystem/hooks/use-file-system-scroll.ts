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
//
// Why the pending offset now verifies: the first `onContentSizeChange` used to
// apply the consumer's offset exactly once and never check whether it landed.
// On web a single `scrollTo` can be clobbered — by a later layout pass, by the
// browser's own scroll restoration, or by content whose height is still settling
// when the offset arrives. `pendingOffsetRef` therefore stays armed until a
// genuine scroll reports the target, so a clobbered apply retries on the next
// content-size change instead of silently losing the requested position.

import { type RefObject, useCallback, useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { isClampedScroll, isRestoreConfirmed, toScrollNode } from '../logic/file-system-scroll';
import { useFileSystemConsumer, useFileSystemStoreContext } from '../store/file-system-context';

/** The subset of a FlatList/ScrollView ref the scroll contract reads: the live node, on web. */
type ScrollableHandle = { getScrollableNode?: () => unknown };

export function useFileSystemScroll(applyScrollTo: (offset: number) => void, scrollNodeRef?: RefObject<ScrollableHandle | null>) {
  const consumer = useFileSystemConsumer();
  const setScrollOffset = useStore(useFileSystemStoreContext(), (state) => state.setScrollOffset);

  const applyRef = useRef(applyScrollTo);
  applyRef.current = applyScrollTo;

  // The consumer's explicit offset, re-armed on every prop change and consumed
  // only once a genuine scroll confirms it landed (see `reportScrollOffset`).
  const pendingOffsetRef = useRef<number | null>(null);
  // The last offset the view reported (live scrolls). Never the restore source
  // while a consumer offset is pending — the consumer's explicit value wins.
  // Once it has been applied (or was 0), content remounts restore from here.
  const lastReportedOffsetRef = useRef(0);

  // Apply on mount and whenever the consumer changes the offset. The ref keeps
  // the value even when the container cannot take it yet — `retryPendingScroll`
  // consumes it once content exists and a scroll confirms it landed.
  // biome-ignore lint/plugin: applying an external position record to the scroll container is a genuine effect — the consumer's offset is store state, not render data
  useEffect(() => {
    const target = consumer.initialScrollOffset ?? 0;
    pendingOffsetRef.current = target;
    if (target > 0) applyRef.current(target);
  }, [consumer.initialScrollOffset]);

  const retryPendingScroll = useCallback(() => {
    const pending = pendingOffsetRef.current;
    const target = pending ?? lastReportedOffsetRef.current;
    if (target <= 0) {
      // A pending 0 is consumed here so later retries fall back to the view's
      // own last reported position instead of being blocked by a pending 0.
      pendingOffsetRef.current = null;
      return;
    }
    // Apply, but keep `pending` armed: until a scroll reports the target the
    // next content-size change re-applies it, so a clobbered `scrollTo` retries
    // rather than giving up on the requested position.
    applyRef.current(target);
  }, []);

  /**
   * Whether the live scroll node is hidden right now (a `display: none` pane).
   * The one event that must be suppressed: the browser clamped `scrollTop` to 0
   * without the content moving. A real scroll's own event measurements are not
   * trusted on web — they can be stale or absent while the content settles.
   */
  const isClampedScrollEvent = useCallback(
    () => isClampedScroll(toScrollNode(scrollNodeRef?.current?.getScrollableNode?.())),
    [scrollNodeRef],
  );

  const reportScrollOffset = useCallback(
    (offset: number) => {
      lastReportedOffsetRef.current = offset;
      const pending = pendingOffsetRef.current;
      // A pending restore is confirmed the moment a genuine scroll reports the
      // target — and only then does the consumer's offset stop winning over the
      // self-restore fallback.
      if (pending !== null && isRestoreConfirmed(offset, pending)) pendingOffsetRef.current = null;
      setScrollOffset(offset);
    },
    [setScrollOffset],
  );

  return { isClampedScrollEvent, reportScrollOffset, retryPendingScroll };
}
