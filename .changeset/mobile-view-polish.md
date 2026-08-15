---
'rn-motion-ui': minor
---

feat(ui): mobile FileSystem view polish — selected-state tint, row spacing, drag-ghost cards and a "Move into" drop hint

- Mobile list rows get vertical spacing (8px item separator), rounded corners, and the selected state is now a translucent `info/15` tint with foreground text instead of a solid `info` fill with white text.
- Mobile grid tiles match: the selected glyph box is `info/15` instead of `surface-selected`.
- Single-item drag ghosts in the mobile list and grid views now carry a surface card background, so a lifted row/tile stays visible against the page.
- While a drag hovers over a folder, a "→ Move into <folder>" chip follows the drag ghost (all views, Windows Explorer style), resolving the hovered folder from the drag store's `overZoneId`.
