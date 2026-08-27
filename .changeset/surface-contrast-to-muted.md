---
'rn-motion-ui': patch
---

refactor(theme): fold `surface-contrast` into `muted`

The `surface-contrast` token was a near-duplicate of `muted`: identical in light
mode (`oklch(95% 0 0)`) and a hair apart in dark (`oklch(21% 0 0)` vs
`oklch(24% 0.004 270)`, which carries the same hue-270 tint as the rest of the
surface ladder). The token is removed and every usage now reads `muted`:

- `bg-surface-contrast` → `bg-muted` (tabs, segmented controls, skeletons,
  choice/toggle groups, slider track, overflow-actions shell, swipeable-list
  row + badge, elevated-button white/disabled plates, item-row `muted` variant,
  FileSystem lifting-row tint).
- `bg-surface-contrast-foreground` → `bg-muted-foreground` (story grip dots and
  skeleton bars — this also fixes those stories, which referenced an
  unregistered token and rendered the dots transparent).

`--color-surface-contrast` is gone from `tokens.css` and
`useThemeColor('surface-contrast')` is gone from the theme API. Consumers using
either should switch to `muted` / `bg-muted` (`muted-foreground` for the
foreground pair).
