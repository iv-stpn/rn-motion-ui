---
'rn-motion-ui': patch
---

fix(morph): reduce springiness of the MorphingSwitcher and MorphingFAB morphs

MorphingFAB's morph spring was underdamped (ζ≈0.65), overshooting and settling
with a heavy bounce. Its damping is raised (18 → 22) so the pane still unfolds
with a subtle overshoot but settles faster. MorphingSwitcher shared the
`SPRING_LAYOUT` token; it now uses a dedicated, slightly over-damped spring
(damping 40) so the shared `SPRING_LAYOUT` used by the Dock pill and menu rows
is untouched.
