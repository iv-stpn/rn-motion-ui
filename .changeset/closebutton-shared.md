---
"rn-motion-ui": patch
---

**Extract shared `CloseButton` component; add close button to MorphingModal**

A new `CloseButton` component replaces the inline `Pressable` + `CloseLine` icon pattern used across AdaptiveModal, FullSheet, and MorphingModal. The component is a simple themed close icon button with consistent hit slop and accessibility label.

`MorphingModal` gains a `showClose` prop that renders a `CloseButton` in the top-right corner of the panel. `FullSheet`'s `closeIcon` prop now accepts any ReactNode (previously just an icon override) — pass a `<CloseButton>` or any custom element.
