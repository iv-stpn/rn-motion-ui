---
'rn-motion-ui': minor
---

feat(ChoiceGroup): extract ToggleGroup's `spaced` variant into its own component

- New `ChoiceGroup` component — a row (or column) of flat, independent choice
  chips where one is selected at a time. It is exactly the old `spaced` ToggleGroup
  (gapped items that each carry their own `rounded`/`pill` shape, wrapping instead
  of scrolling), exported as `rn-motion-ui/choice-group`.
- BREAKING: `ToggleGroup` drops the `spaced` variant. Its `variant` prop is now
  `'bordered' | 'connected'` and defaults to `'bordered'`; migrate `variant="spaced"`
  usages to `<ChoiceGroup>`.
