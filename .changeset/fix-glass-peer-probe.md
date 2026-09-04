---
'rn-motion-ui': patch
---

fix(Glass): stop the peer probe from killing every glass surface on Android

The optional-peer resolution in `glass.native.tsx` and `overlay-blur.native.tsx`
verified the native link with `requireNativeComponent('LiquidGlassmorphismView')`.
The peer (`react-native-liquid-glassmorphism`) is a CODEGEN component whose own
JS already registers that name in React Native's view-config registry — so the
probe's second registration threw "Tried to register two views with the same
name", the guard caught it, and every frosted surface / blur scrim silently
degraded to the tint fill / plain dim. On Android 7.3.0 this meant no frost and
no blur anywhere, while the web twin (CSS `backdrop-filter`) stayed fine.

The probe was inherited from the old `@danielsaraldi/react-native-blur-view`
peer (a legacy view manager that never registered in JS); it is structurally
wrong for a codegen peer — it can only throw in exactly the case where the
peer is present and should render.

Resolution is now a `require` presence check only. An installed-but-unlinked
native module surfaces at FIRST RENDER ("View config not found for component
..."), which the new internal `PeerMountGuard` error boundary converts into the
same graceful degradation (Glass → translucent tint fill, scrim → plain dim),
so consumers who bundle the peer without autolinking still degrade instead of
crashing.
