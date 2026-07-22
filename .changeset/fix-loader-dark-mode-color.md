---
"rn-motion-ui": patch
---

Fix loaders (and other `useThemeColor` consumers) rendering transparent and not adapting to dark mode on web.

Two bugs combined to keep loaders black in dark mode:

1. **`useThemeColor`/`useThemeColors` went stale on a manual theme toggle.** On web the hooks read the active token via `getComputedStyle` during render, but only `useColorScheme()` drove re-renders — and that tracks the OS `prefers-color-scheme` media query, not a `.dark`/`.light` class swap on `<html>` (how the Storybook toolbar and most app toggles switch themes). So a class-toggle froze the resolved color at the last commit and it never refreshed. The hooks now also subscribe to the media query and to `class` mutations on `<html>`, re-rendering and re-reading the live CSS var on either signal.

2. **oklch tokens were silently dropped.** `getComputedStyle` returns `@theme` token values verbatim as `oklch(...)`, but React Native's color parser (used by react-native-web for every color style and by react-native-svg) only knows hex/rgb/rgba/hsl/hsla/hwb/named colors and drops anything else — so `backgroundColor: useThemeColor('foreground')` rendered as no color at all (transparent), not black. oklch (and `oklab`/`color()`) values are now rasterised to an sRGB `rgb()`/`rgba()` string via a 1×1 canvas pixel, which RN and Reanimated both parse. Native (which already uses the sRGB static maps) and SSR are unchanged.

The Loader stories no longer hardcode `color: '#111111'`, so each variant resolves from `useThemeColor('foreground')` and follows the theme toolbar (black in light, near-white in dark). The `Percent` track switched from a `${color}26` hex-alpha hack to a 15%-opacity sibling layer, since `color` is now `rgb(...)` and `rgb(…)26` is not a valid color.
