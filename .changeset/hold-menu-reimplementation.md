---
'rn-motion-ui': minor
---

feat(ui): add HoldMenu — a faithful, modernized reimplementation of react-native-hold-menu

New `./hold-menu` entry exporting `HoldMenuProvider`, `HoldItem`,
`HoldMenuFlatList` and `HoldMenuIcon`, reimplementing the upstream library's
API and interaction model field for field (`items` with `text` / `icon` /
`isTitle` / `isDestructive` / `withSeparator`, `actionParams` spread into
`onPress`, `menuAnchorPosition`, `bottom`, `activateOn`, `hapticFeedback`,
`closeOnTap`, `longPressMinDurationMs`), modernized and improved:

- **Reanimated 4 + RNGH v2 Gesture API** — no legacy
  `useAnimatedGestureHandler`; the squeeze/lift runs on the UI thread with
  synchronous `measure()`, and the lifted copy is a **permanently mounted
  portal twin** (`@gorhom/portal`), so the item never remounts — the
  flicker/handover bug class the old `HoldContextMenu` fought with
  `onLiftReady` timing is gone by construction.
- **Rotation-safe** — window dimensions and font scale come from
  `useWindowDimensions` mirrored into shared values, never stale
  `Dimensions` at module scope.
- **Viewport/safe-area clamping** — the item+panel pair travels up together
  on overflow but stops before the item leaves the safe area, the residual
  overflow caps the panel (which scrolls), and the panel is clamped into the
  safe viewport horizontally.
- **Web support** (upstream is native-only) — `'hold'` is a right-click
  (Shift+F10 / ContextMenu key included), tap/double-tap stay on the press,
  children render once (no twin), and the dimmed backdrop closes on
  click-outside. Web activation is DOM events, not RNGH gestures — RNGH web
  cannot fire on synthetic pointer events (`setPointerCapture` rejects
  untrusted pointers), the same split the old port uses.
- **Optional native deps that never break web bundles** — `expo-blur` (iOS
  panel + backdrop blur) and `expo-haptics` are optional peers loaded only
  through guarded platform-split modules imported extensionless; consumers
  without them degrade to the translucent/dim surfaces, and web never sees
  the imports.
- **Accessibility + reduced motion** — rows carry labels and a button role,
  the backdrop is reachable, and reduced motion collapses every animation to
  a cross-fade.

`HoldContextMenu` and its consumers are untouched — this is a parallel
component family.
