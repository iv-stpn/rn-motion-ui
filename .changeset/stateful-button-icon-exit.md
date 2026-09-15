---
'rn-motion-ui': patch
---

Smooth the state icon exit when `StatefulButton` re-arms

The success (`Check`) and error (`WarningLine`) state icons, plus the idle icon,
were rendering through a shared `IconSlot` whose `key` lived on the *inner*
`MotiView` rather than on the direct `AnimatePresence` child. Every slot
therefore collapsed onto the empty key `''`, so `AnimatePresence` could not tell
the icons apart and dropped them abruptly instead of running their exit
animation when the press machine re-armed back to `idle` (or swapped
success ↔ error).

`IconSlot` no longer owns the key; each direct `AnimatePresence` child now
carries its own stable `key` (`success-icon`, `error-icon`, `idle-icon`), so
entering/exiting icons are keyed correctly and fade/scale out smoothly on
reset.
