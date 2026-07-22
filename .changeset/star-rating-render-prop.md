---
"rn-motion-ui": minor
---

Add `renderStar` custom render prop to `StarRating`.

- `renderStar({ size, color, filled })` — replace the built-in `StarSvg` with any node; receives the resolved amber/muted color so consumers don't have to re-implement the color logic
