---
'rn-motion-ui': patch
---

fix(DragManager): clear the stale preview ghost on a preview-less drag

The overlay cached the preview separately from the drag, so an HTML5 chip lifted
outside this manager (no preview) kept the previous drag's preview alive and
briefly re-showed its ghost during the fade-out. The preview is now cached only
while a drag is live, so a drag without a preview clears it.
