---
"rn-motion-ui": minor
---

**FileSystemColumnsView**: cross-column drag and drop.

`draggable` and `onMove` now work in the columns view as they do in the others:
an entry can be dragged across panes and dropped on any valid folder, or on a
column's own background to land in the folder that pane is showing. A ghost chip
tracks the pointer, and the receiving row — or the whole pane, for a drop on its
background — outlines itself.

- Geometry constants `COLUMN_ROW_HEIGHT`, `COLUMN_ROW_STRIDE`, `COLUMN_PADDING`
  and the `columnRowHitAt` hit-test helper are exported from
  `file-system-column`, shared with the marquee and hover resolvers.
- `FS_DRAG_CONTAINER_TEST_ID` gains a `column` key.
