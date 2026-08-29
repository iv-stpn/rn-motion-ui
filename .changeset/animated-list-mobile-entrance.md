---
'rn-motion-ui': patch
---

fix(AnimatedList): render items on Fabric by animating height through a layout transition

`AnimatedListItem` drove its height through `useAnimatedStyle` (a shared value),
which Reanimated drops on the new architecture — Yoga never round-trips the
animated `height`, so the item collapsed to 0 and the list rendered empty on
Android. The height is now a static style whose 0 → content → 0 change rides a
Reanimated layout transition (`layout={LinearTransition}`), matching the
`BouncyAccordion` fix; the inner content is laid out absolutely so `onLayout`
can measure its natural height while the outer is still collapsed. Style props
(opacity/translate/scale) still animate through shared values, which are safe on
Fabric. The exit releases the item on a timer matched to the collapse duration
instead of a `withTiming` completion callback.
