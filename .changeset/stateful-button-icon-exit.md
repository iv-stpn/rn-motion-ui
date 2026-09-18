---
'rn-motion-ui': patch
---

Fix `StatefulButton`'s success/error icon exit shifting the label sideways.

The exiting state icon kept its width and row gap until unmount, so the idle label nudged sideways for the length of the fade. The icon now pops out of the row (absolute positioning) while its fade + scale finishes, leaving the label in place.

Also add a `variant` prop to `StatefulButton` — the shared `Button` variant set minus the `outline`/`outlineDanger` pair.
