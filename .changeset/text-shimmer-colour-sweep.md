---
"rn-motion-ui": patch
---

Fix `TextShimmer` rendering black in dark mode and shimmering imperceptibly. The animated characters bypassed the themed `Text` component, so they fell back to React Native's default black regardless of theme, and moti's declarative `loop` rebuilt its `withRepeat` inside the worklet on every re-render — any theme toggle or parent state change left the repeat with almost no distance to travel and flattened the effect. The sweep now owns a single Reanimated shared value created once, and interpolates each character between `color` (default `muted-foreground`) and `highlightColor` (default `foreground`) as a narrow band travels across the string, so it tracks the active theme and stays fully legible while animating. Both colours are overridable per instance.
