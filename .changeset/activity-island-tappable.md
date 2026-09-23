---
'rn-motion-ui': minor
---

`ActivityIsland` is now tappable: `ActivityIslandState` accepts an `onPress` so tapping an activity routes to that activity, and `ActivityIsland` accepts an `onPress` fallback for the idle strip and for activities without their own handler. With no handler supplied the strip stays non-interactive.

Fixed Android full-screen modals: the content wrapper's reanimated layout transition (an ancestor of every `Modal`) collapsed modals to content height and clipped everything below the fold. That transition is now skipped on Android, so modals lay out full-screen again.
