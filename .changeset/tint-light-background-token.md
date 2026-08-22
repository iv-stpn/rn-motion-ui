---
'rn-motion-ui': patch
---

feat(theme): tint the light-mode `background` token with the neutral hue

`--color-background` in light mode was pure white (`oklch(100% 0 0)`). It now
carries the neutral tint — `oklch(95% 0.004 270)` — so the page background
tracks the same hue-270 direction as the foreground and surface ladder, and is
picked up by the token generator's retint pass instead of staying frozen at
white. The web and native storybook harnesses resolve the token via
`bg-background` rather than the hardcoded `#f6f6f6` / `#ffffff` backdrops they
used before.
