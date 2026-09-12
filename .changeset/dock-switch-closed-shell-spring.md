---
'rn-motion-ui': patch
---

fix(MorphingDockSwitch): run the closed shell's resize on the dock's own spring

Toggling `showLabels` resized the resting shell on the morph spring
(stiffness 440) while the dock items inside it glided on the dock spring
(stiffness 800). The items outran their own `overflow-hidden` container, which
lagged behind and clipped them as it caught up.

The resting closed shell now uses `DOCK_SPRING` (and `DOCK_LAYOUT` on Fabric) —
matching the `Dock` component it mirrors. Only the open and closing morph keep
`MORPH_SPRING`, so the morph's swell-and-hold beat is unchanged.
