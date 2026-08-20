---
'rn-motion-ui': patch
---

feat(FileSystem): the mobile multi-select scrub auto-scrolls and selects past the fold

The scrub used to hit-test only the entries already laid out on screen, so a
finger dragged below the visible tiles (or rows) selected nothing and the list
sat still. The edge-scroll engine that drives drag reordering is now shared
(`useFileSystemAutoScroll`) and fed the scrub's pointer stream, so dragging to
multi-select scrolls the grid/list when the finger goes above or below the
visible content.

A scrub past either edge now also resolves to a `beyond` hit — everything on the
far side of the anchor (the start entry excluded) — instead of `null`, so the
selection extends all the way to the end of the list as the finger rides the
edge. The finger→content mapping compensates for the auto-scroll's offset delta
since calibration, so a finger held still keeps selecting the same entry as the
content moves under it.
