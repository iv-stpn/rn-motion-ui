---
"rn-motion-ui": patch
---

`MenuItem`: the active icon-tile row fills with `info` rather than `primary`

The `iconBackgroundColor` variant painted its active row `bg-primary/75`, with a
`font-semibold text-primary-foreground` label. `primary` is the monochrome token
consumers are meant to repaint with their own brand colour, so the active row
came out near-black in light mode and near-white in dark — an inverted row rather
than a selected one — and any consumer who retinted `primary` got their brand
colour as the selection fill whether they meant to or not.

It is `bg-info` now, at full opacity, with a `text-info-foreground` label: the
same vivid blue that already reads as "this one is picked" elsewhere in the
library, on both schemes, and not a token consumers are invited to repaint. The
label drops to normal weight — the fill carries the state, so the extra weight
was doing the same job twice, and it kept the active row a hair wider than its
neighbours.

`text-info-foreground` is white in both schemes, which is what a vivid blue fill
wants. `primary-foreground` would have flipped to near-black in dark mode.

`MultiStepMenu`'s `MenuRow` picks this up, since it renders the variant. Nothing
to change on your side unless you were relying on `primary` to tint the active
row; that hook is gone on purpose.
