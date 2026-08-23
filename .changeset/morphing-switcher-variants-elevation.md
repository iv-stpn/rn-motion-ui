---
"rn-motion-ui": minor
---

Add a `variant` prop to `MorphingSwitcher`, plus an `elevation` control and web outside-press close, and give `MenuItem` a `labelWeight` override.

- `variant="select"` keeps the original pill that hugs its content; `variant="switcher"` (default) is a full-width bar with stacked carets whose trigger becomes the active row of the open list.
- The trigger now stays mounted through the morph — it re-styles into the active header row instead of unmounting, and the current item is never repeated in the list below.
- `elevation` picks the resting `shadow-elevated-N` float; opening lifts the shell two rungs higher.
- `closeOnOutsidePress` (web, default `true`) folds the switcher on a press outside it; the open trigger is disabled, so the up-caret is now a visual hint rather than a close control.
- The pane opens upward when it would overflow the bottom of the viewport and there is more room above.
