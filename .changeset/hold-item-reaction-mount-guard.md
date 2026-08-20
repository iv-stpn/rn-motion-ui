---
'rn-motion-ui': patch
---

fix(HoldMenu): skip the `useAnimatedReaction` on-mount fire so the first render doesn't flash the twin at the origin

- `useAnimatedReaction` runs its reaction once on mount with `previous === null`, which
  drove `releaseProgress` 1 → 0 → 1 over `HOLD_ITEM_TRANSFORM_DURATION` and flashed every
  twin opaque at (0,0) while the in-place item hid — the "all files stacked in one spot"
  first-render bug. The guard returns early on that mount call; a real activation or
  deactivation always has a defined `previous`.
