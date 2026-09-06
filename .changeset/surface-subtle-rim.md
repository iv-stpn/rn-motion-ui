---
'rn-motion-ui': patch
---

fix(Surface): subtle rim by default, faster dropoff, more opaque glass

- The `Rim` specular edge is subtle by default — peak `intensity` 0.5 and
  `thickness` 1px — so a frosted `Surface`, `Card`, `IconButton` or `Button`
  reads as a crisp hairline rather than a heavy glow.
- New `falloff` knob on `Rim` (default 2) makes the highlight drop off inward
  faster — a power curve instead of the old linear ramp.
- The frosted `glass` tint is slightly more opaque (light 0.55 → 0.6, dark
  0.45 → 0.5), and the light-mode hairline border that overlapped the rim is
  removed.
