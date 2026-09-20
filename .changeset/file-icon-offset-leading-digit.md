---
'rn-motion-ui': patch
---

Give the generated file-icon glyphs' numeric attribute values a leading digit, so the paper's gradients survive on native instead of collapsing to flat white.

`file-icon-glyphs.tsx` is generated, and it emitted four gradient stops with their `offset` written the way the source SVG spells it — `.5`, `.85`, `.55`, `.5`. That is a legal SVG number, but react-native-svg does not parse `offset` with `Number()`: it matches it against `/^([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(%?)$/`, which demands a leading digit. A value that misses the match warns (`".5" is not a valid number or percentage string.`) and returns `0`, and since the stops are then sorted by offset, every one of them lands on `0` and the last wins. The page gradient's `#e5e5e5 → #f6f6f6 → #ffffff` ramp became `#ffffff` throughout — a flat sheet with no shading — and the curl's cast shadow lost three quarters of its alpha. On web nothing changed, because the DOM accepts `.5` in an `offset`; only native was affected, and only in a device log or on a device.

`offset` is the only attribute this can happen to: `stdDeviation` and `stopOpacity` are read with `Number()`/`+`, and `d` and `transform` are handed to parsers implementing the SVG grammar, where a leading dot is legal throughout. So `scripts/gen-file-icons.mjs` now gives a leading zero to any attribute value that is *entirely* such a number, as it is serialised — and deliberately leaves the mini-language attributes as authored, both because a leading dot there is not a defect and because the vendored art is full of them (`.28312` in the Video logo's matrix, `-.243` midway through Acrobat's path data) and rewriting those would bury a four-value fix in churn.

`file-icon-glyphs.tsx` is regenerated; the diff is the twelve numeric values in `FilePaperGlyph` and nothing else. The suite had nothing reading the glyphs and the symptom only appears on a device, so a test now pins both halves: that no numeric attribute value is written dot-leading, and that every `offset` handed to react-native-svg is one its parser accepts.
