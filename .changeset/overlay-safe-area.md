---
"rn-motion-ui": minor
---

feat(overlays): safe-area insets on by default for full-screen overlays

`FullSheet`, `BottomSheet`, `Drawer`, and `AdaptiveModal` now accept a `safeArea` prop (default `true`) that applies device safe-area insets — status-bar top and home-indicator bottom — to the overlay content.

When `react-native-safe-area-context` is installed and a `<SafeAreaProvider>` is present in the tree, real device insets are used. If the package is absent, insets fall back to zero so existing consumers without it are unaffected.

Pass `safeArea={false}` to opt out and manage insets yourself.
