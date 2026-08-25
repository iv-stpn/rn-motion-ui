---
'rn-motion-ui': major
---

feat: flatten `Card` by default

**Breaking change**

`Card`'s `elevation` default flips from `3` to `0`, matching `Input` (and the new flat `Button` default). A plain `<Card>` now renders the flat `surface-3` fill with no shadow or border; pass `elevation={3}` to restore the previous resting card.

The `Interactive` story's `Elevation` control now starts at `0` so the flat default is visible.
