---
'rn-motion-ui': patch
---

feat(FileSystem): info-toned drop hint chip with a stable testID

The "Move into <folder>" chip that follows the drag ghost now renders the
folder name (and its arrow) in the `info` accent so the destination reads as
one accent-coloured unit, tightens its padding, and sits flush under the
ghost. It also gains a `FS_DROP_HINT_TEST_ID` so stories assert on the chip
directly rather than matching its rendered text.
