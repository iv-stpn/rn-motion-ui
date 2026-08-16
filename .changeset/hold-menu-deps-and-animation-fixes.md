---
'rn-motion-ui': patch
---

fix(ui): hold-menu — expo deps become hard dependencies, blur no longer janks, item stays put, web anchors correctly

- **Dependencies**: `expo-blur` and `expo-haptics` moved from optional
  peer-dependencies to hard dependencies, so the native blur and haptics
  modules are static imports (the platform-split `.native`/`.ts` twins still
  keep them out of web bundles). The guarded dynamic `require` + fallbacks are
  gone.
- **Blur lag**: the backdrop/panel blur `intensity` is now a static prop
  instead of a per-frame `animatedProps` animation — animating it made
  expo-blur recompute the blur every frame and jank on device. The layers still
  fade in through their container opacity, and only the theme `tint` stays
  animated.
- **Item stays put**: the held item no longer travels with the menu. It holds
  its position with the existing scale squeeze while the portal twin carries
  the travel when the menu overflows — matching upstream, so a menu that fits
  in the anchor slot leaves the item in place instead of lifting it.
- **Web positioning**: the held item is measured relative to the provider's
  root view (its `pageX`/`pageY` offset is subtracted), so the menu anchors to
  the item even when the root is offset from the viewport origin — fixing the
  menu appearing in the wrong place and the item sliding off screen on web.
