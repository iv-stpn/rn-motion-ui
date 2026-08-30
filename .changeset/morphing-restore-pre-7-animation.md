---
'rn-motion-ui': patch
---

fix(MorphingFAB, MorphingSwitcher): restore the pre-7.0.0 morph animation on web

The Fabric migration drove both components' size morphs through a single
`layout` transition, which flattened the web/storybook feel — the FAB's
staggered "unfolding" springs and the switcher's `SPRING_LAYOUT` size morph
both regressed to one uniform spring. The morph now splits by platform: web
restores the original `animate`-driven size springs (FAB width snaps open fast,
height bounces; switcher morphs `height`/`width` on `SPRING_LAYOUT`), while
native keeps the Fabric-safe `layout` transition since layout props don't
round-trip Yoga through `useAnimatedStyle` there.
