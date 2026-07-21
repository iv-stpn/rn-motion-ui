---
"rn-motion-ui": patch
---

fix(table): use `alignItems` for SkeletonCellPulse cell alignment

`justifyContent` acts on the main axis — in the column-direction cell `View`, that's vertical. `alignItems` is the correct prop for horizontal (cross-axis) alignment of the skeleton pulse within its column slot.
