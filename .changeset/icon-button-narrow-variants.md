---
'rn-motion-ui': patch
---

refactor(IconButton): narrow the variant surface to `neutral` | `elevated`; MorphingFAB takes a `variant` instead of `elevation`

- IconButton drops the Button variants (`inverse`, `ghost`, `outline`, `danger`,
  `special`, `outlineDanger`, `ghostDanger`) in favour of a two-variant
  surface-3 plate: `neutral` (plain) and `elevated` (surface-3 + the input's
  diffuse floating shadow). Icon stroke and spinner colour now always use the
  plain foreground token, and the ripple is never `filled`.
- MorphingFAB: the `elevation` prop is replaced by `variant`
  (`IconButtonVariant`, defaulting to `elevated`), which drives the collapsed
  trigger; the expanded pane now always paints `surface-3` with the
  floating-input shadow.
