---
'rn-motion-ui': patch
---

feat(MorphingSwitcher): `fullWidth` prop and a tighter stacked caret; fix the Dock/Switcher close height

- **`fullWidth`** — a new `MorphingSwitcher` prop (default `false`) that stretches
  the trigger and its open pane across the parent. Out of the box the switcher now
  hugs its content (icon + label + carets); `variant="switcher"` no longer implies
  full-width. `expandedWidth` is ignored when `fullWidth` is set.
- **Stacked caret** — the switcher's up/down chevrons now overlap by `0.3×` their
  size so the pair reads as one tight glyph; `MorphingDockSwitch` was brought down
  from `0.5×` to match.
- **Close height fix** — the shell's Fabric layout transition now waits `CLOSE_LEAD`
  before descending on close, so the height/width collapse keeps the same beat as
  the Moti radius/translateY spring instead of clipping the staggered rows before
  their exit plays. The switcher shell is also keyed by width mode so toggling
  `fullWidth` remounts it instead of retaining the stale measured width.
