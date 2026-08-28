---
'rn-motion-ui': patch
---

fix(theme): separate `muted` from `background`

`muted` was indistinguishable from the page in light mode — `oklch(95% 0 0)`
against a `background` of `oklch(95% 0.004 270)`, a lightness delta of zero, so
every muted fill (tabs and segmented-control tracks, the slider track, toggle
groups, skeletons, the elevated-button disabled plate, the `muted` item-row
variant) vanished on a `bg-background` page. Dark mode read as too close to the
low end of the surface ladder.

- Light: `oklch(95% 0 0)` → `oklch(90% 0 0)` — 5% below `background`, 7% below
  `surface-1`, 10% below the `surface-3` card white.
- Dark: `oklch(24% 0.004 270)` → `oklch(28% 0.004 270)` — 7.5% above
  `surface-1`, 4.5% above `surface-2`.

`muted-foreground` is unchanged and still clears its fill in both schemes (50%
ink on 90%, 73% ink on 28%). The native `LIGHT_OKLCH` / `DARK_OKLCH` tables in
`use-theme-color.ts` move with the sheet, so `useThemeColor('muted')` matches.

Apps that relied on `bg-muted` blending into `bg-background` should override
`--color-muted` back to `oklch(95% 0 0)` / `oklch(24% 0.004 270)` in their own
`@theme` block.
