---
"rn-motion-ui": minor
---

Add `open` / `onOpenChange` props to overlay components.

`BottomSheet`, `AdaptiveModal`, `FullSheet`, and `MorphingModal` now accept the new controlled props:
- `open` (replaces `visible`)
- `onOpenChange(open: boolean)` (replaces `onClose`)

The previous `visible` / `onClose` props are kept as deprecated aliases and will be removed in a future major release.
