---
'rn-motion-ui': patch
---

Fix `BlurProvider` gating on an unreliable Fabric check that crashes Android release builds.

`isFabric()` read `global.nativeFabricUIManager` at module-load time, but that binding is defined lazily and can still be `undefined` when the bundle's module scope runs in embedded-JS release builds. On Fabric the check returned `false`, so `BlurProvider` resolved the optional peer's `BlurTarget` and React tried to mount its `TargetView`, which is not registered without `@danielsaraldi/react-native-blur-view` — crashing with `Can't find ViewManager 'TargetView'`.

Detection now uses the eagerly-installed `RN$Bridgeless` flag (always `true` on RN 0.80+) with the lazy Fabric binding kept only as a fallback for RN 0.76–0.79, so `BlurTarget` is correctly skipped on the new architecture regardless of bundle timing.
