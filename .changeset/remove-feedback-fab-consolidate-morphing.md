---
"rn-motion-ui": minor
---

**Remove `FeedbackFAB` — consolidate into `MorphingFAB`**

- Removed the `FeedbackFAB` component and its `./feedback-fab` / `./feedback-widget` export paths. The `MorphingFAB` render-prop API covers both the feedback form and action menu use cases directly — see the updated `MorphingFAB` stories for inline examples of each.
- Fixed a 1px icon alignment issue in the `MorphingFAB` trigger button caused by the shell border clipping the pressable area.
- `MorphingFAB` stories now feature an interactive playground with a toggle between feedback and menu demos, plus standalone play-function-driven demos for each.
