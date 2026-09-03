---
'rn-motion-ui': patch
---

Fix an Android crash when the optional `@danielsaraldi/react-native-blur-view` peer is installed but not autolinked (Bun/pnpm/yarn-berry auto-install optional peers, so the `require()` succeeds while the native `BlurView` ViewManager is never registered).

The blur resolution now probes `requireNativeComponent('BlurView')` (and the provider probes `TargetView`) before trusting the `require()` result, so an installed-but-unlinked peer degrades to the plain translucent dim instead of throwing `IllegalViewOperationException` on mount.
