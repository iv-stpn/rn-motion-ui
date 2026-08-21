---
'rn-motion-ui': patch
---

feat(elevated): add a flat `elevation={0}` variant

The `elevation` prop on every surface component (Card, RadioCard, CheckboxCard,
WheelPicker, CloseButton, and the menu/modal panels) now accepts `0`. It renders
the flat resting surface — a `surface-3` fill with no shadow and no border — so
a panel can sit flush against its backdrop instead of always floating.
`elevated()`, `surfaceBackground()` and `elevatedShadow()` handle the `0` case,
and `SURFACE_CLASSNAME` carries a `0` entry for the dropdown panels.
