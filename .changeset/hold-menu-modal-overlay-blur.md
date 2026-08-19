---
'rn-motion-ui': patch
---

feat(menus): blur the overlay scrims and lighten the backdrop dim

HoldMenu's backdrop and the modal overlays (AdaptiveModal, MorphingModal,
ActionFeedbackModal, BottomSheet, Drawer) now paint a `BlurView` under their
dim so the page behind reads as frosted glass instead of a flat wash — native
`UIVisualEffectView`/`QmBlurView` on device, CSS `backdrop-filter` on web. The
blur comes from the optional peer `@sbaiahmed1/react-native-blur` (New
Architecture, RN 0.80+); when it is not installed the scrims degrade to their
previous plain-translucent rendering. HoldMenu's backdrop dim is also much
lighter, so the blur reads through on both platforms instead of the near-opaque
black web scrim.
