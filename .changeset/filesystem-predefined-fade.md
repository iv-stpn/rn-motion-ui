---
'rn-motion-ui': patch
---

fix(FileSystem): use predefined FadeIn/FadeOut for tile enter/exit

The grid tile's enter/exit used a custom `Keyframe`, which on web triggers
Reanimated's keyframe cleanup that re-homes the entering node with
`position: absolute` — pulling it out of flex-wrap flow so the grid stops
reflowing and later adds look like they never arrive. Predefined
`FadeIn`/`FadeOut` are keyframes Reanimated already knows, so that cleanup path
never runs.
