---
'rn-motion-ui': patch
---

fix(HoldMenu): cross-fade the twin handover on release to kill the flicker

On close the portal twin and the in-place original each faded with a 150 ms
delay followed by a zero-duration snap. A `duration: 0` timing resolves on
the frame after its delay, and on web those two snaps can land on different
frames, leaving a one-frame hole where neither copy is visible — the release
flicker. The handover now cross-fades over the tail of the return instead of
snapping, so the twin and original blend with no gap.
