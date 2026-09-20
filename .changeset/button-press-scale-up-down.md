---
'rn-motion-ui': minor
---

Add `scaleUp` / `scaleDown` press modes to the button family, and flip the default press animation to **scale up**.

The uniform press mode was a single `scale` value that shrank the button to `pressScale` (default `0.93`). It's now two directional modes: `scaleUp` — the new default, which grows the button to `1.05` on press — and `scaleDown`, the previous behaviour. `pressMode="scale"` is renamed to `pressMode="scaleDown"`, and `pressScale` still overrides the settled scale for either direction.
