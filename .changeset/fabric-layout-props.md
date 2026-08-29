---
'rn-motion-ui': patch
---

fix(motion): drive animated layout props through layout transitions so morphs animate on Fabric

Animating `width`/`height`/`top`/`left`/`margin`/`padding` through Moti's
`animate`/`from`/`exit` pipeline doesn't round-trip Yoga on the new architecture
(Fabric), so size changes either collapsed to 0×0 (clipped to nothing) or snapped
instead of animating. Every animated layout prop now rides a Reanimated layout
transition (`layout={LinearTransition}`) with a static size, or a transform:

- `MorphingFAB`, `MorphingSwitcher`, `MorphingMenu`, `MorphingModal` and
  `DynamicIsland` keep a static shell and animate the size via `layout`.
- The `Tabs` indicator and `Dock` pill glide via layout transitions.
- `BouncyAccordion`'s expand/collapse and row separation move to layout transitions.
- `OverflowActions`' reveal, `MultiStepMenu`'s back button and below-title slot,
  and `StatefulButton`'s icon slot hold a static footprint and fade/slide instead
  of tweening `width`/`height`/`padding`.
- `Loader` bars loop `scaleY` on a static height instead of `height`.
- `ActionFeedbackModal`'s morph icon keeps a static size and morphs the fill.
- `CylinderCarousel` and `SortableList` move constant layout props out of
  `useAnimatedStyle` into static style.

Each layout transition mirrors the spring/timing it replaces and collapses to a
snap under reduced motion.
