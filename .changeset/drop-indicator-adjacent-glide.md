---
'rn-motion-ui': patch
---

feat(FileSystem): drop indicator glides between adjacent targets, snaps to distant ones

The shared drop indicator used to spring onto every new target, which reads
as a glide down a list but flings the outline across the whole file area on
a long hop. It now distinguishes neighbours from distant targets via a new
`rectsAdjacent` geometry helper: crossing between adjacent rows/tiles glides
(one continuous sweep), while crossing to anything further — a folder on the
other side of the pane, a skipped tile, a full row between — snaps the
outline straight to the target instead of springing it across.

Regression coverage: `rectsAdjacent` unit tests (edge-to-edge, gapped,
overlapping and diagonal neighbours, commutativity).
