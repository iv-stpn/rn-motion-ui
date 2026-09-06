---
'rn-motion-ui': minor
---

feat(Surface): reintroduce frosted-glass surfaces on the restored blur-view peer

A reusable `<Surface>` primitive returns (`rn-motion-ui/surface`), rebuilt on the
`@danielsaraldi/react-native-blur-view` optional peer restored by 740a7095 —
a translucent `glass` tint over a backdrop blur, with the `react-glass-rim`
specular edge recreated as a cross-platform SVG `Rim` layer.

- **Web** — CSS `backdrop-filter` blur under the themed `bg-glass` fill; the
  web twin never imports the optional peer, so a consumer without the native
  module still bundles.
- **Native** — the peer's `BlurView` frosts its local backdrop on iOS; on
  Android it blurs the enclosing `BlurProvider`'s `BlurTarget` and degrades to
  the translucent `glass` tint when the peer (or a provider) is absent. An
  inline pane (`inline`) rendering inside its own blur target falls back to the
  tint fill on Android rather than cycle the RenderNode graph.
- **Theme** — new `glass` design token (white glass in light, dark glass in
  dark), resolved through the `bg-glass` utility and
  `useThemeColor('glass')`, so the fill follows the active scheme and any
  consumer `@theme` override.
