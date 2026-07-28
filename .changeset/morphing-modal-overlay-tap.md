---
"rn-motion-ui": patch
---

fix(MorphingModal): close on overlay tap on the web

Tapping the scrim did nothing on react-native-web. The layer that positions the card fills the whole modal and is meant to let taps through to the scrim behind it, which it asked for with `style={{ pointerEvents: 'box-none' }}`. But `box-none` is not real CSS — react-native-web implements it in the StyleSheet compiler, which expands it into `pointer-events: none` on the node plus `pointer-events: auto` on its direct children. That expansion only runs for compiled styles; the inline-style path passes the value straight to the DOM, where the browser discards `pointer-events: box-none` as invalid and the node keeps the default `auto`. The positioning layer therefore sat on top of the scrim and swallowed every tap. Moving the style into `StyleSheet.create` runs it through the compiler. Native reads the same style object directly and was unaffected.

`testID` now also propagates to the scrim as `<testID>-backdrop`, matching `BottomSheet`, so the dismiss target is addressable from tests.
