---
"rn-motion-ui": patch
---

fix(AnimatedBadge): the loading spin and the pulse survive a parent re-render

Both loops were declarative `MotiView`s with `transition={{ loop: true }}`. Moti
resolves its pose inside a `useAnimatedStyle` whose dependency list includes the
`animate` object, and that object is a fresh literal on every render — so any
re-render from above (a status change, an interval tick, a theme swap) re-ran the
worklet and re-issued the tween *from the current value*. The spin restarted
mid-revolution with a full second to cover the remaining arc, which read as a
stutter and a speed change rather than one steady turn; a badge under a parent
that re-renders every 50ms barely moved at all.

`withTiming`'s default easing was the second half of it. `Easing.inOut(Easing.quad)`
eases to a stop at each revolution boundary, so even an uninterrupted loop paused
once per turn.

The spin and the halo are now two small components driving one shared value each,
started in an effect and cancelled on unmount, with `Easing.linear` on the spin —
the same shape the Marquee and TextShimmer loops already use. Re-renders never
touch a shared value, so the loop keeps its phase.

One shared value now drives both the halo's opacity and its scale, which also
keeps them in phase: as two moti properties they drifted apart, since moti
defaults `scale` to spring while `opacity` is timing.

No API change — `status="loading"` and the pulse behave as documented, they just
actually animate continuously now.
