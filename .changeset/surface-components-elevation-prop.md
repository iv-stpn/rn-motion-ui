---
'rn-motion-ui': patch
---

feat(surface): expose an `elevation` prop on the remaining surface components

Dock, BouncyAccordion, Drawer, BloomMenu, FullSheet, SwipeableList and
BottomSheet previously hardcoded their surface level (`surface(0)` / `surface(3)`).
They now accept an `elevation` prop (0–8) so their fill, shadow and dark-mode rim
can be lifted or flattened, matching Card and the other panels. Their stories —
plus WheelPicker and Popover — also gained an `Elevation` chip for live
customization.
