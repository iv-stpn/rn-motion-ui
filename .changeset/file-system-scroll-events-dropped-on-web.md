---
'rn-motion-ui': patch
---

fix(FileSystem): stop dropping scroll events on web

A scroll of the file list could silently never reach the consumer: `onScroll`
guarded itself with `scrollEventCanScroll`, which compared the event's own
`contentSize` against the viewport and early-returned when those measurements
were stale or absent (`?? 0` made the failure silent). The `?y=` URL param and
per-tab saved position then stayed at the old offset, and the self-restore
fallback drifted too.

The guard existed to keep a `display: none` pane from reporting the browser's
forced `scrollTop` of 0 as a real position, so it is kept — but retargeted:

- the discriminator is now the live scroller's `offsetParent` (a hidden pane has
  `offsetParent === null`), read from the node at event time instead of trusting
  the event's measurements;
- a null/unknown node fails open, so a real scroll is never dropped;
- bookkeeping (scroll ref, `shiftZoneRects`, hover/marquee refresh) is no longer
  coupled to whether the offset gets reported;
- `initialScrollOffset` restoration now verifies the landing against the reported
  offset and retries on the next content-size change until confirmed.
