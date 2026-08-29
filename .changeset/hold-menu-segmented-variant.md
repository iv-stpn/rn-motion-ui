---
'rn-motion-ui': minor
---

feat(menus): rebuild HoldMenu on the shared `Menu`; add a `variant` prop to menu rows

`HoldMenu` no longer renders its own bespoke row/separator components. It maps
its items onto the shared `Menu` in a new `'segmented'` style, so the hold-menu
and every other menu read from one row implementation.

**New API on `Menu` and its rows:**

- `Menu`, `MenuItem`, `MenuSeparator` and `MenuLabel` take a `variant` prop —
  `'base'` (default, the CommandPalette look: icon leading, no borders between
  rows) or `'segmented'` (the hold-menu look: icon trailing, a hairline below
  each row but the last, centred captions, solid band separators). `MenuVariant`
  is exported from `Menu`.
- `MenuItem` and `MenuLabel` take `bottomBorder` to draw that hairline.

`HoldMenu`'s panel also changes shape: instead of a fixed 40%-of-window width it
now sizes to its widest row (measured off-screen before the first hold), floored
at 160 px and still capped at 40% of the window so a long label wraps instead of
running off the edge. Rows are full-height (40 px) now, matching the
`'segmented'` scale.

Nothing is removed from the public API — `HoldMenu`'s old `MenuItem`, `MenuItems`
and `Separator` were internal.
