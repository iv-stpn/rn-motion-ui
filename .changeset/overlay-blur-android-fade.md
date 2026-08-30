---
'rn-motion-ui': patch
---

fix(Overlay): Android backdrop blur, and a scrim that fades without killing the frost

`OverlayBlur` now blurs on Android via `@react-native-community/blur` (the
Dimezis `BlurView`, rendered on the system Render Thread on API 31+) where it
previously degraded to the plain translucent scrim. iOS keeps
`@sbaiahmed1/react-native-blur`; both are optional peer dependencies resolved
with a guarded `require`, so a consumer without the platform's peer still
bundles and falls back to the unblurred scrim. The blur radius drops from 30 to
12 to match the lighter Android blur.

The blur layer now fades its own opacity in step with the menu's enter/exit,
moved outside the dim's opacity fade across `AdaptiveDropdown`, `Drawer`,
`MorphingMenu`, `MorphingModal` and `Popover`. That matters on web: an ancestor
with `opacity < 1` becomes a CSS "backdrop root" that clips the backdrop, so
the frost never rendered under the old parent fade. The dim also switches from
`bg-foreground/*` to `bg-black/*` for a neutral scrim in light and dark themes.
