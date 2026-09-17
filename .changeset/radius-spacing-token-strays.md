---
'rn-motion-ui': patch
---

Normalize radius and spacing strays to design tokens

Components that still hardcoded raw `rounded-*` classes now read from the
corner-radius tokens. Menu rows, the colour-picker swatches and the command
palette adopt `rounded-interactive`, and `RadioCard` / `CheckboxCard` /
`SwipeableList` rows use a new `--radius-card-compact` token (16 px) instead
of `rounded-2xl`. The `rounded-l-*` / `rounded-r-*` side variants follow the
same token. `Radio` and `Checkbox` express their row gap through the `gap-3`
utility rather than a raw `gap: 12` style literal, and the `MultiStepMenu`
back button expresses its width and padding through classes instead of an
inline style.
