---
'rn-motion-ui': patch
---

feat(ColorPicker): HSV colour picker in an adaptive dropdown

Adds a `ColorPicker` (at `rn-motion-ui/color-picker`) that opens inside an
`AdaptiveDropdown` — a floating panel on wide screens, a bottom sheet on narrow
ones. It composes a saturation/value plane, a hue slider and a preset swatch
grid (the `reanimated-color-picker` anatomy), rebuilt on the package's own
PanResponder + `react-native-svg` primitives with no extra dependency. The
colour math lives in a pure HSV↔RGB↔hex↔HSL module so it runs identically on
web, native and in unit tests. Controlled or uncontrolled; `onChange` fires
during drags, `onComplete` when a drag ends or a swatch is tapped.
