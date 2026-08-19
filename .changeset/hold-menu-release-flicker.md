---
'rn-motion-ui': patch
---

fix(HoldMenu): snap the twin handover on release to kill the flicker

On close the portal twin and the in-place original switched visibility with
two independent zero-duration timings. On web those could resolve on
different frames, leaving a one-frame hole where neither copy is visible — a
release flicker — and a cross-fade fix dimmed instead, since two stacked
semi-transparent layers don't sum to full opacity. Both copies now read a
single shared value, so the switch is atomic: no overlap window to dim, no
gap to blink.
