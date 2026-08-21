---
'rn-motion-ui': patch
---

fix(MultiStepMenu): slide panes at a constant rate instead of a spring

The pane swap was driven by a spring, which made the two layers (held a full
width apart) read as a hand that speeds up and slows down — a "staggers, then
moves at the end" feel. It now uses a linear `timing` (280ms), so the strip of
pages slides past the window at a constant rate, mirroring Tabs' slide push.
