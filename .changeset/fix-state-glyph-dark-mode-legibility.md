---
"rn-motion-ui": patch
---

Fix `StatefulButton` and `ActionFeedbackModal` success/error glyphs vanishing in dark mode.

Both used the `surface` token for the success/error label (`StatefulButton`) and the morph `Check`/`X` glyphs (`ActionFeedbackModal`). `surface` is near-white in light mode but near-black (`#111111`) in dark mode, so against the saturated green/red success/error backdrop the text and icons were illegible in dark mode. Switched to theme-exempt white (`#ffffff`) so the glyphs read against the fill in both themes, matching the existing convention in `SwipeableList`.
