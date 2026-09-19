---
'rn-motion-ui': patch
---

Retune the interactive size and padding tokens.

`--spacing-interactive-sm/md/lg` step down from 36/48/64px to 32/42/56px, and `--spacing-interactive-pad-xs/sm/md/lg` widen from 8/12/16/20px to 12/16/20/24px, tightening the button family's box heights while giving labels more breathing room. The JS pixel mirrors (`INTERACTIVE_HEIGHT` and `BUTTON_METRICS.padX`) follow so the effect layers and the pill/FAB rims stay on the same curve as the boxes they sit in.
