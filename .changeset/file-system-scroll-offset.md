---
'rn-motion-ui': minor
---

feat(FileSystem): scroll-offset contract — `initialScrollOffset` restore + `onScrollOffsetChange` report

`<FileSystem>` now exposes the active view's vertical scroll position both ways: `initialScrollOffset` restores an exact position on mount (or whenever it changes, retried once the container has content), and `onScrollOffsetChange` reports the live offset as the user scrolls. Consumers can keep a position record (a URL param, per-tab state) in lockstep and restore it on refresh. Applies to the single-axis vertical views (`list`, `icons`, `mobile-grid`, `mobile-list`); `columns` and `gallery` scroll per-pane/horizontally and don't participate.
