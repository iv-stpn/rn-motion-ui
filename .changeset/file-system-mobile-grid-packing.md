---
'rn-motion-ui': patch
---

feat(FileSystem): pack the mobile grid by width, and size the folder glyph by its own ratio

The mobile grid was fixed at two columns, so a tablet or a wide pane got two
stretched tiles instead of a full row. Columns are now packed from the measured
width at a 140pt floor and then share out the slack: every phone viewport still
ships two across (320pt lands at 144pt tiles, 430pt at 199pt), a container packs
past two from ~510pt on and reaches five at 768pt, and anything below the floor
drops to a single column rather than squeezing a tile past what a two-line name
can hold beside its kebab. At phone width the tiles land exactly where the old
math had them. The geometry moved to a pure `mobileGridMetrics` module with unit
tests; `Demo: Mobile grid (wide)` shows the packing at tablet width.

The folder is the one landscape glyph in a set of portrait pages, so squaring it
off against them left it reading as the runt of a grid of files — half their
height in the grid, and hemmed into a 28pt lane in the list. Both mobile views
now size it by the height it may fill and let it spread into the width its ratio
asks for, less a small optical inset that offsets the folder being a solid block
of colour where a page is drawn as one. The list's glyph lane grows to 40×31,
shaped to the folder rather than square, so a page keeps its height under what a
touch row can give it. `rn-motion-ui/file-icon` gains
`FOLDER_GLYPH_ASPECT_RATIO` and `folderGlyphWidthForBox`, the counterpart of
`fileIconWidthForBox`.

`renderEntryIcon` now receives one size for both files and folders — the largest
square the box holds, 72 in the mobile grid and 31 in the mobile list — where it
previously got a different number per kind (96/56 and 20/28). A custom icon that
was drawn to fill the number it was handed will change size accordingly.
