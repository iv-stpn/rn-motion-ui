---
"rn-motion-ui": minor
---

StatefulButton: add an `elevated` prop that swaps the flat button for the glossy `ElevatedButton` chip. The chip keeps its gloss/fill/rim/coloured drop-shadow through the whole state machine instead of greying out, and each state adopts the matching elevated variant — idle/loading map the flat variant onto the palette (danger family → `danger`, everything else → the monochrome `neutral` fill), success switches to the glossy `success` chip and error to the glossy `danger` chip (full fill, not a flat overlay).

ElevatedButton: add a `noDisabledOpacity` prop that keeps a non-interactive chip's gloss/fill/shadow instead of flattening to the muted plate, and export `elevatedContentColor(variant, disabled, colors)` so a consumer rendering its own content can match the chip's label/icon colour exactly.
