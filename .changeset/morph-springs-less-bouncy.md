---
'rn-motion-ui': patch
---

fix(morph): damp the MorphingSwitcher and MorphingFAB morph springs

The morph springs were underdamped, so the pane overshot and settled with a
visible bounce. MorphingFAB's spring ran at ζ≈0.65 (stiffness 200, damping 18);
MorphingSwitcher shared the `SPRING_LAYOUT` token. Both now settle without
overshoot — the FAB spring is critically damped (damping 28) and the switcher
uses a dedicated, slightly over-damped spring (damping 40) so the shared
`SPRING_LAYOUT` used by the Dock pill and menu rows is untouched.
