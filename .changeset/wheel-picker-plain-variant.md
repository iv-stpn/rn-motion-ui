---
"rn-motion-ui": minor
---

Add `variant` to `WheelPicker` (`'card'` | `'plain'`, default `'card'`).

`card` is the existing self-contained control: elevated `Card` surface with an inset rounded centre pill. `plain` drops the container entirely — transparent, no surface, no shadow, no radius of its own — so several wheels can be butted together inside one parent frame and read as a single control (a date picker, say). Previously this needed per-wheel style overrides (`borderWidth: 0`, `backgroundColor: 'transparent'`) that fought the `Card` instead of replacing it, and left every wheel painting its own shadow underneath the shared frame.

The rounded centre pill survives in both variants, since it is what marks the selected row; `plain` just uses a tighter horizontal inset so a narrow column (a 56px day wheel) still gets a readable band and adjacent wheels keep distinct pills rather than fusing into one bar. `elevation` is ignored under `plain`.
