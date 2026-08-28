---
'rn-motion-ui': minor
---

feat: give `MorphingFAB` and `MorphingSwitcher` the menu `overlay` + `closeOnOutsidePress` surface

The two morph-in-place components now fold on an outside press and can dim the
page behind them, joining the rest of the menu family:

- **`MorphingFAB`** gains **`closeOnOutsidePress`** (`boolean`, default `true`) —
  pressing/clicking outside the expanded pane closes it — and **`overlay`**
  (`boolean`, default `false`) — a dimming scrim behind the pane.
- **`MorphingSwitcher`** gains **`overlay`** (`boolean`, default `false`); it
  already honoured `closeOnOutsidePress`.

Both default `overlay` to `false` so the morph-in-place look is unchanged — pass
`overlay` to opt into the scrim, like `MorphingMenu`.

Both components also moved from `components/display/` to `components/menus/`, so
their Storybook stories now sit under `Menus/`. The public import paths
(`rn-motion-ui/morphing-fab`, `rn-motion-ui/morphing-switcher`) are unchanged, so
no migration is required.
