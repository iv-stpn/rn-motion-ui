---
'rn-motion-ui': patch
---

fix(MorphingFAB): make the collapsed root click-transparent again on web

The root's inline `pointerEvents: 'box-none'` was dropped by react-native-web's
inline-style path (which doesn't support `pointerEvents`), so the fixed full-size
box the 7.2.0 Android-Fabric fix introduced silently intercepted pointer events
over any content beneath the FAB corner on web. Hoisted the static root frame
into `StyleSheet.create` so `box-none` compiles to the atomic `pointer-events:
none` + `> * { pointer-events: auto }` rules. Native is unaffected.
