---
'rn-motion-ui': minor
---

feat(IconButton): add the `elevated` variant and a 48px `lg` size; MorphingFAB
now renders its trigger as an IconButton

- IconButton gains an `elevated` variant: a `surface-3` fill with the input's
  large diffuse floating shadow (`shadow-floating`) — the floating-input recipe,
  so an icon-only control reads as a raised card without a rim.
- IconButton `lg` grows from the 40px interactive ramp to 48px — the MorphingFAB
  trigger size (icon stays 20px, tile scales to 28px) — so the FAB can render as
  an IconButton.
- MorphingFAB: the shell no longer paints its surface while collapsed. The
  trigger is now an IconButton (`elevated`, `lg`, pill) that carries its own
  background and shadow; the shell's `bg-surface-N` + rim + drop shadow now
  apply only to the expanded pane (still driven by the `elevation` prop).
- BREAKING (type-only): `MorphingFAB`'s `icon` prop is now
  `ComponentType<IconProps>` (rendered through the trigger IconButton's size and
  stroke-colour pipeline) instead of `ReactNode`. Pass the icon component (e.g.
  `icon={MessageSquare}`), not a JSX element.
