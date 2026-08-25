---
'rn-motion-ui': major
---

feat: add an `elevation` (`0–8`) prop to `Button`, and flatten it by default

**Breaking change**

`Button` gains `elevation` (`0–8`, default `0`), which drives the shadow *only* — a Button's background still comes from its `variant`, not the surface ladder. The float is no longer baked into the variant table, so the five filled plates (`danger`, `success`, `warning`, `info`, `special`) that previously shipped `shadow-elevated-3` are now flat by default; pass `elevation={3}` to restore their old look. `floating` still overrides whichever `shadow-elevated-N` rung resolves.

The `Interactive` story gains an `Elevation` control and an elevation ladder, both starting at `0` so the flat default is visible.
