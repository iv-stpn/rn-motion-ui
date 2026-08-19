---
'rn-motion-ui': patch
---

feat(Input): border-driven state and base/elevated/floating variants

Input state now drives a 1px web border (idle border, foreground on focus,
danger on error) instead of a shadow, and the `surface`/`filled` variants are
replaced by `base` (flat white), `elevated` (muted raised), and `floating`
(surface-3 with a large diffuse shadow). The default shape is now `pill`.
