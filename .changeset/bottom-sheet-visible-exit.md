---
'rn-motion-ui': patch
---

fix(BottomSheet): make the close animation visible

The close spring was overdamped (natural frequency ≈31.6), so the sheet
snapped off-screen almost instantly and the exit read as a jump rather than
a slide. Retuned to a critically damped spring (≈15.6, roughly half the
speed) so the slide-out is a deliberate, perceptible motion. The open spring
is unchanged.
