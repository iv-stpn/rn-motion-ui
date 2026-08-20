---
'rn-motion-ui': minor
---

feat(Button): add `success`, `warning` and `info` status-tone variants

- `Button` and `StatefulButton` gain `success`, `warning` and `info` variants,
  each a vivid status fill (`bg-success`/`bg-warning`/`bg-info` with the
  elevated shadow) paired with its `*-foreground` label, icon and spinner. The
  status fills carry through the elevated and glossy palette mapping, so a
  loading or success state keeps its tone.
- The `inverse` label now reads from the `background` token (not `surface-1`),
  so it pairs exactly with the `bg-foreground` face.
