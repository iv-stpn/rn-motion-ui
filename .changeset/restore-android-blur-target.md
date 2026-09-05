---
'rn-motion-ui': patch
---

fix(Overlay): restore Android blur scrims on the new architecture

The 2026-09-03 Fabric gate skipped the blur peer's `BlurTarget` wrap on the
new architecture, degrading every Android `overlay="blur"` scrim (modal
menus, teleported FAB overlays) to a plain translucent dim. The peer
(`@danielsaraldi/react-native-blur-view` v3.0.2) is Fabric-aware — it ships
codegen specs with ViewManager delegates and resolves its `blurTarget`
through the FABRIC UIManager, which reaches the app-window target from
inside an RN Modal — and modal/teleported blur was on-device-verified on
Fabric before that gate shipped (2026-08-31/09-02 APKs). The white screens
that motivated the gate were storybook `layout` + CSS-only dimension bugs,
already root-caused and fixed independently. `BlurTarget` is mounted again
on every architecture; the absent-peer `requireNativeComponent` probe and
the tombstone-confirmed `inline` crash-guard (scrims inside their own
target degrade to the dim) are unchanged. Android `overlay="blur"` now
frosts again behind modal menus and teleported overlays.
