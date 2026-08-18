---
'rn-motion-ui': patch
---

fix(FileSystem): drop indicator (and drop targeting) track the list while it scrolls mid-drag

Zone rects are window coordinates measured at drag start (or the last layout
pass), and a scroll moves the rows without any layout event — so the store's
cached boxes, and the shared drop indicator painted from them, kept resolving
against the pre-scroll positions the moment the list moved under a drag
(auto-scroll at the edge, or a wheel). The views now report each scroll delta
to the store (`shiftZoneRects`), which re-bases the cached rects of the zones
that move with the content (rows, tiles, overlays — never the static body and
pane fallbacks) and re-resolves the drop target, so the hit test and the
outline both follow the content. The indicator snaps to the shifted rect on a
scroll (a spring would trail a moving row) and still glides between targets on
a pointer crossing.
