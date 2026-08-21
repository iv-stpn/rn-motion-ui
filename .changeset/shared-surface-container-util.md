---
'rn-motion-ui': patch
---

feat(surface): add a shared surface-container class helper and adopt it across containers

A new `surface(elevation, radius?)` helper combines the elevation ladder
(`bg-surface-N shadow-elevated-N`) with an optional corner-radius token, so
surface containers spell their fill, shadow and radius in one place. Card,
RadioCard, CheckboxCard, BouncyAccordion, SwipeableList, Dock, every menu/modal
panel, the file-system background menu, and the draggable stories now build their
container surface through it. `surface(0)` renders the flat resting surface
(`bg-surface-3`, no shadow or border) for containers that should sit flush.
