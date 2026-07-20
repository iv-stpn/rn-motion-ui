---
"rn-motion-ui": patch
---

Fix animation correctness and loading indicators

- **AnimatePresence**: exiting items now stay at their original list position instead of being appended at the end (insertion-order tracking via `keyOrderRef`).
- **AnimatedList**: exit animation gains a downward `translateY: 8` drop alongside the existing fade+scale.
- **Loader**: dots bounce now uses `EASE_IN_OUT` easing for a smoother feel.
- **Button**: `buttonContent` rendered before ripples so it sits above them in z-order; `pointerEvents="none"` moved from `style` to a MotiView prop on each ripple.
- **StatefulButton**: replaces the SVG spinning ring with a three-dot `DotsLoader`; button width is held stable during loading by keeping the idle text as a hidden sizer.
- **ActionFeedbackModal**: loading state now uses `<Loader variant="dots">`.
