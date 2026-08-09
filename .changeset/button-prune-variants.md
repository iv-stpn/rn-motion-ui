---
"rn-motion-ui": patch
---

**Button: prune `outline`, `ghostPrimary` variants; tighten label + ripple colours**

The `outline` and `ghostPrimary` variants are removed. All internal and story usages of `outline` switch to `ghost`. Label colour map simplified: `primary` now uses `text-foreground`, `secondary` uses `text-surface-1`, `ghost` uses `text-foreground`. Filled-ripple set updated (`secondary` added, `primary` removed) so the white shimmer only fires on opaque dark fills. Spinner colour resolution consolidated.

New helpers in `button-scale.ts`: `buttonRadiusClass()` (CSS twin of `buttonRadius()`), `STATE_ICON_SIZE`, and `STATE_BUTTON_GAP_CLASSNAME` for proportional state-icon spacing per size.
