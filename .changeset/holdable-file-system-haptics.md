---
'rn-motion-ui': patch
---

feat(Holdable, FileSystem): haptic feedback on holds, and a scrub tick with a checkbox pulse

`Holdable` and `HoldDraggable` gain an opt-in `hapticFeedback` prop, backed by a
new `lib/haptics` twin (`expo-haptics` on native, a no-op on web) so the native
module never enters a web bundle. `HoldMenu` now routes through the same module.

The file-system mobile views pass `hapticFeedback="Medium"` to their inert holds,
so the long-press that joins multi-select cues in the hand. Dragging to
multi-select fires a distinct `Selection` tick each time the finger crosses into
a new entry, and the checkbox under the finger squeezes then springs back — a
pulse that reduced-motion preferences skip.
