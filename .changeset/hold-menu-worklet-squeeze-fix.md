---
'rn-motion-ui': patch
---

fix(ui): HoldMenu — squeeze duration resolved in the worklet body, not a default parameter

The scaleHold worklet referenced HOLD_ITEM_SCALE_DOWN_DURATION in a default
parameter expression. Default-parameter expressions live outside the worklet
body, so the native UI runtime's closure injection cannot see them — starting
a hold on device threw a ReferenceError for the constant. The duration is now
an optional parameter resolved inside the body (the same pattern scaleTap
already used), so the squeeze runs on device again.

(Story-only addition: an Interactive playground story for HoldMenu.)
