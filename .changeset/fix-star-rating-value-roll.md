---
"rn-motion-ui": patch
---

Fix `StarRating` rolling value label shoving the `/max` label sideways on change.

The animated value digit was rendered inline next to `/max`, so the entering and exiting digits sat side-by-side and shifted the `/max` label on every change. The slot now reserves the digit's width with a hidden sizer and absolutely positions the animated label so the two digits overlap during the transition instead of pushing neighbors. Mirrors the `TextRolling` layout.
