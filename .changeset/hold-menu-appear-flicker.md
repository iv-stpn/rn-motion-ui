---
'rn-motion-ui': patch
---

fix(HoldMenu): fade the twin in on activation to kill the appear flicker

The portal twin snapped to full opacity the instant the menu opened. When the
menu had room and the item did not travel, the in-place original and the twin
swapped in a single frame, exposing their sub-pixel differences as a flicker.
The twin now fades in over the still-opaque original, and the original only
drops out once the twin is fully opaque — so the two never overlap
semi-transparently (no dim) and never leave a gap (no blink).
