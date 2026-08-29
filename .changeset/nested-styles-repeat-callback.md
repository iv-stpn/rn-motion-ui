---
'rn-motion-ui': patch
---

fix(motion): resolve nested style objects and fix repeating-transform callback

Two correctness fixes in the Moti animation core:

- Nested style objects (`shadowOffset`, `textShadowOffset`, …) now animate each
  inner value independently. Previously the whole `{ width, height }` object was
  handed to the spring, so a shadow-offset animation collapsed onto a single
  shared value instead of tweening each channel.
- `onDidAnimate` no longer fires twice on repeating transform sequences. The
  transform path passed the callback to `withRepeat` in addition to the per-step
  callback, so it fired once per repetition *and* once more at final completion —
  unlike every other repeating animation, which fires once per repetition.
