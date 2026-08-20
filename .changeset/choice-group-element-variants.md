---
'rn-motion-ui': patch
---

feat(ChoiceGroup): add a `variant` prop and rename `ToggleGroup`'s variant to `containerVariant`

- `ChoiceGroup` gains a `variant` prop (`'neutral' | 'info' | 'outline' | 'outline-info'`, default `'outline'`) controlling how the selected item is highlighted — `neutral`/`info` fill the accent as the background, `outline`/`outline-info` draw a coloured border.
- `ToggleGroup`'s `variant` prop is renamed to `containerVariant` to keep the container-level `'bordered' | 'connected'` axis distinct from the element-level `variant`.
