---
'rn-motion-ui': patch
---

fix(FileSystem): smooth, velocity-driven auto-scroll while a drag rides the list edge

The auto-scroll that runs while a drag hovers near a scrollable's top or bottom
edge used to step the offset by a fixed 6px every 16ms and re-read the LIVE
scroll offset on every tick. Scroll events land a frame late on native (and
asynchronously on web), so the read was frequently stale: the same offset got
commanded two frames in a row — the list moved on every OTHER frame, which
reads as staggered steps — and could even command a smaller value than the
previous one, a visible backward hop. `useFileSystemDragScroll` now owns a
monotonic offset cursor, seeded once per run from the live offset and never
re-read while running, and commands it every animation frame. Speed is a
velocity integrated toward a target set by how deep the pointer sits in the
edge zone (0 at the zone boundary → full speed at the edge), with acceleration
ramping in and deceleration easing out — including through zero when the
pointer crosses from the top zone to the bottom one, so direction flips glide
instead of snapping.
