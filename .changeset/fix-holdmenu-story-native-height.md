---
'rn-motion-ui': patch
---

fix(HoldMenu): size the story frame with a native-safe height on Android

The HoldMenu stories framed the canvas with a CSS-only
`height: calc(100vh - 3rem)` cast to a ViewStyle. React Native Web honours
the calc(), but Yoga drops the invalid dimension on native — the wrapper
collapsed to 0 and the provider's `flex: 1` chain white-screened the story
on the Android storybook APK. The frame now takes its height from
`useWindowDimensions` so the scenes render on every platform.
