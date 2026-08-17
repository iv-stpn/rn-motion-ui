---
'rn-motion-ui': patch
---

fix(HoldMenu): type `animatedContainerStyle` as `useAnimatedStyle<ViewStyle>`

The squeeze hook's result type was `ReturnType<typeof useAnimatedStyle>` —
an unparameterized `AnimatedStyle`, which the typechecker resolves to a
plain object without the view-style keys the `HoldItem` wrapper spreads into
an `Animated.View` `style` array. Parameterizing with `ViewStyle` gives the
style the actual shape the consumers rely on.
