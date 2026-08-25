---
'rn-motion-ui': patch
---

fix(RadioCard, CheckboxCard): drop the resting outline so an unselected card reads as a plain surface

Both cards drew a `border-border` outline at rest, so an unselected card was
ringed against the surface it sat on and a group read as a grid of boxes. The
border is now purely the selection affordance: unselected it is transparent and
the card leans on the wrapper's `surface()` fill, and selecting one brings the
`info` edge in with the tint it already animated.

`RadioCard` animates its border, so the unselected end is the accent at alpha 0
via `tintAt` rather than a literal `transparent` — the same reason the
background tint already used it, since a literal would interpolate through
`rgba(0, 0, 0, 0)` and darken the edge on the way in. `useThemeColor('border')`
is no longer read. `CheckboxCard` switches its static class to
`border-transparent`.

Both keep the `border` width reserved in both states, so selecting a card
doesn't shift its contents. Passing a `border-*` color through `className`
still gives a card a resting outline.
