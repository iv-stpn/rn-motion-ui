---
'rn-motion-ui': minor
---

feat(Text): add a `weight` prop that resolves a per-weight font token

- `Text` now accepts a `weight` prop (a `TextWeight` union derived from the
  component's variants) that maps to a per-weight font-family token, instead of
  relying on Tailwind `font-*` utility classes. `TextWeight` is exported
  alongside `Text`.
- The prop threads through every typography derivative — `ActionSwapText`,
  `TextCascade`, `TextNumberTicker`, `TextReveal`, `TextRolling` and
  `TextShimmer` — so each exposes the same `weight` prop. `TextShimmer` renders
  its shimmered characters through an animatable wrapper of `Text` (reanimated's
  `Animated.Text` can't resolve the per-weight font token), so `weight` applies
  there too.
- The Button family's label ramp (`LABEL_TEXT_CLASS`) drops `font-medium`;
  buttons now set `weight="medium"` at each render site, and every consumer of
  the old `font-*` classes migrates to `weight`.
