---
'rn-motion-ui': patch
---

fix(FileSystem): restore scroll after a hidden-then-shown container

A FileSystem inside a container that flips `display: none` (a hidden tab pane,
a collapsed section) measures 0, its view's tiles unmount, and the browser
clamps the scroll container back to the top. Two things then destroyed the
position the user actually had:

1. The clamp fires a scroll event reporting offset 0, which the views
   forwarded to the consumer — wiping the last real position (the consumer's
   URL/per-tab record AND the view's own restore source). Views now skip
   reporting events from containers that cannot scroll
   (`scrollEventCanScroll`), so only real scrolls report.
2. With the position preserved, `retryPendingScroll` had no way to re-apply it
   — it only ever applied the consumer's `initialScrollOffset`, which the
   consumer never changes for a live scroll. It now falls back to the last
   offset the view reported, so a content remount re-applies it — the view is
   self-restoring.

New story `ScrollSurvivesHiddenContainer` proves the scroll comes back after a
hide-then-show and that the clamp's bogus 0 never reaches the consumer.
