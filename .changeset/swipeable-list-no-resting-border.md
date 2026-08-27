---
'rn-motion-ui': patch
---

fix(SwipeableList): drop the row's resting border so it reads as a plain surface

The draggable row drew a `border-border` outline at rest, ringed against the
surface it sat on. The border is now owned by `surface(elevation, floating)`
like every other surface in the app: elevated rows wear the `shadow-elevated-N`
ring, `floating` rows the diffuse halo, and a flat (`elevation=0`) row carries
no border at all. The `elevation` and `floating` props that already existed on
`SwipeableList` now fully control the row's boundary.
