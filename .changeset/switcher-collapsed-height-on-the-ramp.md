---
'rn-motion-ui': patch
---

fix(MorphingSwitcher): rest the collapsed shell at the shared interactive height

The collapsed shell wrapped its trigger in the pane's `p-1` inset, so a switcher
rested `2 × 4px` taller than a `Button` or `IconButton` of its own size — `md` sat
at 40px beside a 32px icon button — and could never join a row of mixed controls.

The inset now frames the OPEN pane only: the collapsed shell is exactly the
trigger's footprint, so its height (and its pill radius, half that height) lands
on the same `--spacing-interactive-*` rung as the button family at every size.
The open pane is unchanged — it keeps its inset, its 240px default width and its
row geometry, and a trigger wider than `expandedWidth` still opens without being
clipped horizontally now that the pane's width is computed from the trigger plus
that inset.
