---
"rn-motion-ui": patch
---

Close reduced-motion gaps in animated components.

Six component directories never called `useReducedMotion` despite driving visible animations. All are now fixed:

- **`use-sheet-presence`** — new `reducedMotion` option; swaps `withSpring` → `withTiming(160 ms)` for both open and close.
- **`BottomSheet`** — reads `useReducedMotion()` and passes it to `useSheetPresence`.
- **`FullSheet`** — replaced the inline `AccessibilityInfo` + `useState` + `useEffect` re-implementation with the shared `useReducedMotion` hook.
- **`ActionFeedbackModal`** — `reduced` propagates into `MorphIcon` (all four morph transitions) and into the backdrop/card enter/exit transitions.
- **`AdaptiveDropdown`** — `reduced` drives the panel enter spring (→ timing) and exit duration/easing.
- **`AnimatedList`** — all `withTiming` calls in `AnimatedListItem` switch to 80 ms linear on reduced-motion; `reduced` added to both dependency arrays.
- **`MultiStepMenu`** — slide and arrow transitions computed from `useReducedMotion()` rather than file-level constants.

`Card` and `CardChoice` are static (no animation imports) and were excluded. `TextCascade` inherits coverage via `ActionSwap`.
