---
"rn-motion-ui": minor
---

`HoverMenu`'s render-prop `trigger` now receives `{ open, toggle }` instead of just `{ open }`, matching `AdaptiveDropdown`. A trigger that is pressable in its own right (a `Button`, a `Pressable`) claims the press, so the wrapper's own toggle never fires — `toggle` is what lets such a trigger open the menu. Also adds `triggerIsPressable`: set it and the wrapper drops its button role, `aria-expanded`, `onPress` and tab stop, since the trigger already carries all four. Without it, web renders a `<button>` inside a `<button>` and keyboard users get two tab stops for one control. Hover stays on the wrapper either way, so web hover-open is unaffected. Both are additive — a plain node trigger keeps the wrapper-owns-the-press behaviour unchanged.

Stories: add the `glossy` trigger kind to the shared story `TriggerButton`, which gives every overlay playground that showcases trigger variants (ActionFeedbackModal, AdaptiveModal, BottomSheet, CommandPalette, FullSheet, MorphingModal) a GlossyButton chip. The `HoverMenu` and `AdaptiveDropdown` playgrounds gain that same Trigger chip row, so all four launch styles can be swapped under one live overlay; each keeps its previous plain-node trigger in a section of its own to demonstrate the wrapper-owns-the-press path.
