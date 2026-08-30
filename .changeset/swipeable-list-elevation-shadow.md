---
'rn-motion-ui': patch
---

fix(SwipeableList): apply the row elevation shadow outside the clipped surface

The row's `overflow-hidden` clip — needed to keep the sliding draggable surface
inside the rounded row — was also swallowing the `shadow-elevated-N` /
`shadow-floating` box-shadow that lived on the inner surface. The shadow now
sits on the outer row wrapper, whose own clip doesn't cut its own shadow, so the
`elevation` ladder drop and the `floating` halo render again. The background tint
stays on the draggable surface.
