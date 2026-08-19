---
'rn-motion-ui': patch
---

feat(Text): forward refs and adopt the themed Text across components

`Text` now wraps the host in `forwardRef` so it can hand a ref to Reanimated,
and `MotiText` (the animated `Text`) renders the themed `Text` instead of the
raw `react-native` one. The form, navigation, and file-system components that
imported RN's `Text` directly now render the themed `Text`, so their labels pick
up the typography scale and weight tokens.
