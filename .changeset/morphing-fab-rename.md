---
"rn-motion-ui": minor
---

**Rename `FeedbackWidget` → `MorphingFAB`; feedback flow becomes `FeedbackFAB`**

`FeedbackWidget` is renamed to `MorphingFAB` — a generic floating action button that morphs into a rounded pane. It takes arbitrary pane content (plain children or a render-prop receiving `{ close }`), a configurable trigger `icon` (defaults to a plus), controlled/uncontrolled `open` state, and `expandedWidth`/`expandedHeight`. The former feedback form flow is rebuilt on top of it as `FeedbackFAB` (same API, same states, same testIDs).

- New subpaths: `rn-motion-ui/morphing-fab`, `rn-motion-ui/feedback-fab`.
- The `rn-motion-ui/feedback-widget` subpath is kept as a deprecated alias re-exporting `FeedbackFAB` as `FeedbackWidget` — no breaking change.
- New story: `+` FAB morphing into a 3-action menu (Display/MorphingFAB).
