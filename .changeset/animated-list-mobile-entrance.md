---
'rn-motion-ui': patch
---

fix(AnimatedList): drive the entrance from a post-commit effect so items animate in on native

`AnimatedListItem` issued its entrance `withTiming` directly from the inner
view's `onLayout` callback. On native, `onLayout` can fire in the same commit
that first applies the animated zero height — before Reanimated has registered
the shared value's starting point — so the height tween started from the full
height and items landed already-open with no entrance animation. The entrance
now runs from a `useEffect` after that commit, matching the file-system
animated-row pattern, so the timing always starts from zero.
