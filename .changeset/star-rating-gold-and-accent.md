---
"rn-motion-ui": patch
---

`StarRating`: warmer default gold, and inactive stars sit on `accent` rather than `border`

Two color changes, both visible without touching a prop:

- The default `activeStarColor` moves from `#edde51` to `#fec700` — the same fixed, theme-exempt gold intent, but warmer and more saturated, so a filled star reads as gold rather than as pale yellow.
- Inactive stars now fall back to the theme `accent` color instead of `border`. `border` is a translucent hairline token (`oklch(0% 0 0 / 0.1)`), which is right for a 1 px rule and too faint for a filled glyph — empty stars were nearly invisible on light surfaces. `accent` is opaque and tracks the theme, so the empty half of a rating stays legible on both schemes.

Pass `activeStarColor` / `inactiveStarColor` to keep the previous values.
