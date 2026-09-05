---
'rn-motion-ui': patch
---

fix(Overlay): drop the ViewManager probes that killed Android blur

The `requireNativeComponent('BlurView')` / `requireNativeComponent('TargetView')`
probes in `overlay-blur.native.tsx` and `blur-provider.native.tsx` threw
"Tried to register two views with the same name" on Android — the blur peer
(`@danielsaraldi/react-native-blur-view` v3.0.2) is a CODEGEN peer whose JS
registers both names in `ReactNativeViewConfigRegistry` the moment the
module loads, so the probe's second registration fails EXACTLY when the
peer is present and healthy. The caught throw resolved `BlurView`/`BlurTarget`
to null and every Android `overlay="blur"` scrim degraded to the plain
dim — on every release since the probes landed (7.2.3+). Same trap the
glass peer hit (9a414b4c). The guarded `require()` alone is the presence
check; an installed-but-unlinked peer surfaces at first render, not here.
Combined with the restored `BlurTarget` mount on the new architecture,
Android blur scrims (modal menus, teleported overlays, HoldMenu backdrop)
frost again; the `inline` crash-guard is unchanged.
