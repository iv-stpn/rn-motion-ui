---
'rn-motion-ui': patch
---

Fixed `PopoverTrigger` nesting a `<button>` inside a `<button>` (and the console warning that comes with it) when its child is already a pressable, such as a `Button` or `IconButton`. The trigger wrapper now steps back from claiming `role="button"` for custom-node children, matching how `AdaptiveDropdown` and `HoverMenu` treat a pressable trigger.
