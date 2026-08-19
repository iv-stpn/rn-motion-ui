---
'rn-motion-ui': patch
---

fix(menus): disable the overlay scrim blur on Android

Android's native `QmBlurView` is not performant enough to run under a
full-bleed overlay scrim, so `OverlayBlur` now no-ops on Android. HoldMenu's
backdrop and the modal overlays (AdaptiveModal, MorphingModal,
ActionFeedbackModal, BottomSheet, Drawer) degrade to the plain translucent dim
there, while iOS keeps `UIVisualEffectView` and web keeps the CSS
`backdrop-filter`.
