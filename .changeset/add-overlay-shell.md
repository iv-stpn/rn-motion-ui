---
"rn-motion-ui": minor
---

Extract shared overlay boilerplate into `OverlayShell` and `useSheetPresence`.

- New `OverlayShell` component — wraps `Modal` with `useModalRender` mount lifecycle and a11y props; accepts a render-prop child receiving `{ open, onExitComplete }` to drive `AnimatePresence`
- New `useSheetPresence` hook — manages mount state and `translateY` shared value for slide-from-bottom sheets (extracted from `BottomSheet`)
- `ActionFeedbackModal`, `FullSheet`, and `MorphingModal` now use `OverlayShell` internally
