---
'rn-motion-ui': patch
---

fix(FileSystem): settle the expand animation before sampling drop points in `DragIntoOwnSubtree`

The `DragIntoOwnSubtree` story measured its drop coordinates right after
clicking the expand chevron, while the children it revealed were still animating
open (height 0 → full). The rows below — `Photos/` included — shift most in the
first ~100ms and keep creeping for the full 280ms, so a point sampled mid-anim
was stale by the time the release was hit-tested against the drop zone's measured
box. The play function now waits until the entering row has grown to full height
before sampling either target, replacing a fixed settle count that raced under
load.
