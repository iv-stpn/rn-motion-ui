---
'rn-motion-ui': patch
---

Fix `Toaster` glass mode to keep the toast's variant colour.

A frosted (`glass`) toast previously washed out to the neutral `glass` tint, losing the variant's hue. It now composites a translucent tint of the variant's own fill (80% opacity) over the backdrop blur — on both the web and native twins — with the label, description and status icon in the variant's foreground ink, so a glass toast reads as a frosted version of the solid variant pill.
