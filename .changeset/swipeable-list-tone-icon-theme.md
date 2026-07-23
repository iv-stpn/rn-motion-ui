---
"rn-motion-ui": patch
---

Fix `SwipeableList` action-icon contrast in dark mode for `neutral`/`primary` tones.

`neutral` and `primary` action badges use theme-inverting backgrounds (`bg-muted`/`bg-primary`), but their icon colours were hardcoded hex (`#fafafa`/`#71717a`), so icons went invisible or low-contrast when the theme flipped. The render path now resolves these icon colours reactively via `useThemeColors()` (`muted-foreground`/`primary-foreground`), overriding any colour baked into the passed icon node so the stroke stays legible against the badge. Chromatic tones (`success`/`warning`/`danger`) keep white icons — their vivid backgrounds are stable across themes. The exported `SWIPE_TONE_ICON_COLOR` static map is now documented as a light-mode fallback for icons rendered outside the component.
