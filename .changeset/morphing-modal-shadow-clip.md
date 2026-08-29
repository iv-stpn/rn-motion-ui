---
'rn-motion-ui': patch
---

fix(MorphingModal): stop the elevated shadow from being clipped by the panel

The panel carried `overflow-hidden` on the elevated surface itself, which clipped
the shadow ring to nothing and left only the flat background — the shadow must
render outside the clip region, as in RadioCard / ElevatedButton. The clip now
lives on a dedicated inner wrapper that also carries the corner radius, so the
surface, its shadow, and the rounded clip all share one `panelRadiusClass`
(top-only for the bottom sheet, all four corners otherwise).
