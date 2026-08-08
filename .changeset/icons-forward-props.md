---
"rn-motion-ui-icons": patch
---

Icon components now forward all remaining props to the underlying `<Svg>` element via `...props`. `IconProps` extends `SvgProps` from react-native-svg, so consumers can pass any SVG prop (hitSlop, onLayout, pointerEvents, opacity, etc.) through to the root SVG.
