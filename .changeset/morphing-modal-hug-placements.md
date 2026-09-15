---
'rn-motion-ui': minor
---

Add a `hug` variant to `MorphingModal`

A new `hug` boolean stretches the panel to the screen width (drops the
`max-w-sm` cap) with a symmetric `p-4` left/right inset, instead of the centered
card. On `placement="bottom"` the same `p-4` inset also replaces the larger
bottom offset, so the panel hugs the screen by the same amount on the left,
right and bottom.
