// The scroll-event decision the four scrollable views share, split out of
// `use-file-system-scroll.ts` so vitest can exercise it: the hook module pulls
// react-native in (through the store), which the unit-test pipeline cannot parse.
// This module imports nothing from react-native.

/**
 * The live scroll node, read at event time from the ref's `getScrollableNode()`.
 * On web that is a DOM element; on native it is a numeric handle, so the views
 * pass it through {@link toScrollNode}, which reduces it to the one property the
 * decision needs.
 */
export type ScrollNode =
  | {
      /**
       * `null` when the node or an ancestor is `display: none` — the hidden-pane
       * clamp — and non-null for a visible, laid-out scroller.
       */
      offsetParent: unknown;
    }
  | null
  | undefined;

/**
 * Turns whatever `getScrollableNode()` returned into a structural {@link ScrollNode}.
 * The native return is a numeric handle (no `offsetParent`), which the guard here
 * reduces to `null`; a `null` node never reads as clamped, so native always reports.
 */
export function toScrollNode(value: unknown): ScrollNode {
  if (typeof HTMLElement === 'undefined' || !(value instanceof HTMLElement)) return null;
  return { offsetParent: value.offsetParent };
}

/**
 * Whether a scroll event is a hidden-pane clamp and must be suppressed entirely.
 *
 * A pane flipped to `display: none` (an inactive tab) makes the browser clamp the
 * scroller's `scrollTop` to 0 and emit a scroll event reporting 0 — without any
 * content having moved. Reporting that 0 would overwrite the position the user
 * actually had. A null/unknown node is *not* clamped: a real scroll whose node
 * could not be read must still report, so the decision fails open rather than
 * silently dropping a scroll.
 *
 * The event's own `contentSize`/`layoutMeasurement` are deliberately not consulted:
 * on react-native-web they are not guaranteed to be current when the DOM fires
 * `scroll`, so an overflowing-but-settling list would be misread as empty.
 */
export function isClampedScroll(node: ScrollNode): boolean {
  if (node === null || node === undefined) return false;
  return node.offsetParent === null;
}

/**
 * How close a reported offset must be to a pending restore target to count as
 * "reached". The apply is an unanimated `scrollTo`, so the landing is exact; the
 * tolerance absorbs fractional-scroll rounding only.
 */
export const SCROLL_RESTORE_TOLERANCE = 1;

/** Whether a reported offset confirms a pending restore to `targetOffset`. */
export function isRestoreConfirmed(reportedOffset: number, targetOffset: number): boolean {
  return Math.abs(reportedOffset - targetOffset) <= SCROLL_RESTORE_TOLERANCE;
}
