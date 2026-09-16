---
'rn-motion-ui': patch
---

Add a `hug` prop to MorphingFAB

The expanded pane now stretches to the screen width with the same symmetric
16px left/right inset the FAB already hugs its corner with, instead of the
fixed `expandedWidth` pane. Left, right and bottom all hug the screen by the
same amount — the FAB counterpart to MorphingModal's `hug`.
