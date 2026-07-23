---
"rn-motion-ui": patch
---

Satisfy the `check-no-hardcoded-colors` lint across `src/components` (no runtime change — comments only).

- **Loader `Percent`**: the track-tint rationale comment mentioned `rgb(...)` / `rgb(…)26` in prose, which tripped the script's color-literal regex on lines that contain no actual color literal (the tint uses the `color` variable). Reworded to avoid the `rgb(` token rather than mislabel the line `theme-exempt`.
- **SwipeableList `ICON_COLOR`**: the exported static map's `neutral`/`primary` entries (`#737373` / `#fafafa`, light-mode fallbacks for external consumers) are now annotated `/* theme-exempt */`. They can't call `useThemeColors()` (module-level constant) and are already resolved reactively in-component via `SwipeActionButton`, matching the existing `#ffffff` chromatic entries below.
