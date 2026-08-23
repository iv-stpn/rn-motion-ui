---
'rn-motion-ui': patch
---

fix(FileSystem): re-apply last reported scroll offset when content remounts

A FileSystem inside a container that flips `display: none` (a hidden tab pane,
a collapsed section) measures 0, its view's tiles unmount, and the browser
clamps the scroll container back to the top. The consumer never changes
`initialScrollOffset`, so nothing restored the position the user actually had.
`retryPendingScroll` now falls back to the last offset the view reported, so a
content remount re-applies it — the view is self-restoring. New story
`ScrollSurvivesHiddenContainer` proves scrollTop comes back after a
hide-then-show.
