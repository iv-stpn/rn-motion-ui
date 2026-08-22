---
'rn-motion-ui': patch
---

fix(checkbox): centre the check and dash glyphs and mute the disabled border

The checkmark and indeterminate-dash glyphs are redrawn in a 32×32 viewBox
rendered at 16×16, giving half-pixel placement so both glyphs sit optically
centred instead of drifting by device or zoom level. The box is now `relative` so
the absolutely-positioned mark anchors correctly on web, the glyphs carry a
gutter so their round caps are no longer clipped, and a disabled checkbox now
mutes its border to match its muted fill.
