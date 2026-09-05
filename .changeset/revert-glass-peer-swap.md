---
'rn-motion-ui': minor
---

revert(Glass): drop react-native-liquid-glassmorphism, restore the blur-view stack

Roll back the 7.3.0 blur-peer swap (53956d18) in full: `react-native-liquid-glassmorphism` is removed and `@danielsaraldi/react-native-blur-view` returns as the optional blur peer. The `<Glass>` primitive, the `rn-motion-ui/glass` subpath, the `frosted` prop on Card/Button/IconButton/Input/MorphingFAB/MorphingSwitcher, and the glass-tier scrim degradation are gone; the `BlurProvider`/`OverlayHost`/`BlurTarget` teleport architecture and the `rn-motion-ui/overlay/blur-provider` export are restored, along with the pre-7.3.0 scrim/backdrop blur behaviour on both platforms.

Consumers on 7.3.0: remove the `react-native-liquid-glassmorphism` peer, reinstall `@danielsaraldi/react-native-blur-view`, delete any `<Glass>`/`frosted` usage, and re-mount `BlurProvider` where it was dropped. Consumers on ≤ 7.2.x are unaffected — this returns the package to their API surface.
