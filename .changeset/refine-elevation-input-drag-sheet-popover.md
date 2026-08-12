---
"@rn-motion-ui/ui": patch
---

- **Elevation API**: MorphingFAB, CheckboxCard, and RadioCard adopt the consolidated `elevated()` utility (surface background + shadow). CheckboxCard and RadioCard gain a group-level `elevation` prop with per-card override.
- **Input**: switched from fixed `h-interactive-*` to `min-h-interactive-*` so the field grows with multiline content; replaced `interactive-pad-*` design tokens with explicit padding values.
- **OtpInput**: active slot ring uses `border-2` instead of `ring-2` to avoid clipping on native.
- **Drag system**: hit-test tie-break now prefers the later-registered (more specific) zone; `markDropZoneUpdate` fixes Safari `dragend` coordinate drift; zone registration and unregistration mid-drag re-resolve the target immediately.
- **ReorderableList**: wired `onDragEnter` (was only `onDragOver`); re-measures Dragzone rects when a drag starts so `insertionPosition` computes the correct slot. Added pure-math unit tests for the reorder logic.
- **BottomSheet**: backdrop Pressable is wrapped in a `pointerEvents`-gated View to fix overlay tap-through on web.
- **MorphingModal**: removed unused `contentWidth` tracking; bottom-sheet placement now sizes to `max-w-sm`; scale exit is suppressed for reduced-motion and bottom-sheet variants.
- **OverflowActions**: simplified track styling; Text uses `weight` prop instead of `font-medium` class.
- **Popover**: `PopoverTrigger` accepts a `className` override; story demos trigger-kind switching via `TriggerButton` + `TriggerControls`.
- **Sheet presence**: close spring re-tuned for a snappier dismiss.
