---
'rn-motion-ui': patch
---

fix(morph): damp the MorphingSwitcher morph spring

MorphingSwitcher shared the `SPRING_LAYOUT` token; it now uses a dedicated,
slightly over-damped spring (damping 40) so the shared `SPRING_LAYOUT` used by
the Dock pill and menu rows is untouched.
