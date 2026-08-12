---
"rn-motion-ui": minor
---

**Input: elevation-based state and a `surface`/`filled` variant**

- **State moves from border to shadow** — the idle border is gone; focus and error now prepend a 1px ring (foreground/danger) over a soft drop shadow via the new `--shadow-input*` tokens. Error still wins over focus.
- **New `variant` prop** — `surface` (default) sits on the white `surface-3` card level; `filled` uses the lighter muted grey. Both carry the soft drop shadow.
- The `muted` token steps 94% → 95% so the filled background reads distinct from the surface card.
