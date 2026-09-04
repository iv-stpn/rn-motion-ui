---
'rn-motion-ui': minor
---

Replace the `@danielsaraldi/react-native-blur-view` optional peer with `react-native-liquid-glassmorphism` and add first-class frosted-glass surfaces.

**New surfaces**

- A reusable `<Glass>` primitive (`rn-motion-ui/glass`) — a translucent `glass` tint over a backdrop blur with a `glass-rim` edge. Web renders CSS `backdrop-filter`; native wraps the peer's `LiquidGlassView` (guarded `require`, so it still builds without the module installed).
- A `frosted` prop on `Card`, `Button`, `IconButton`, `Input`, `MorphingFAB` and `MorphingSwitcher` — swap the opaque surface/variant fill for the glass backdrop. `elevation`/`floating` are ignored when frosted; the blur is the depth.

**Dependency swap**

- The optional peer is now `react-native-liquid-glassmorphism` (>=1.0.0). The old peer's bitmap-capture model self-excludes the backdrop, so the `BlurProvider` / `BlurTarget` / `OverlayHost` teleport machinery (and the `./overlay/blur-provider` export) are deleted and overlay scrims render inline.
- Native overlay scrims tier-degrade: `overlay="blur"` normalizes to `"opacity"` below Android API 31 (the new peer is tint-only there). Web blur is unchanged (CSS `backdrop-filter`).
