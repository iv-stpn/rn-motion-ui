---
'rn-motion-ui': patch
---

fix(theme): deepen the `info` token

`--color-info` shifts from `oklch(65% 0.17 247)` to `oklch(58% 0.18 255)` —
a deeper, more saturated blue — across the light, dark, and native OKLCH
sources so every platform stays in parity.
