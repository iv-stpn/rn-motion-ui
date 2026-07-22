---
"rn-motion-ui": patch
---

Fix web theme colours being silently dropped because they resolved to oklch.

`useThemeColor`/`useThemeColors` read `@theme` tokens via `getComputedStyle`, which returns the authored `oklch(...)` strings. Reanimated's colour interpolator and react-native-web's inline-style colour parser only understand sRGB (hex/rgb/rgba/hsl), so animated and inline theme colours were dropped — leaving e.g. the ActionFeedbackModal morph vessel transparent (white glyph invisible against the card) and Loader dots colourless on web. The hooks now resolve oklch (and other non-sRGB CSS colours) to sRGB on web via a 1×1 canvas pixel readback, matching native's static sRGB maps. Native is unaffected.
