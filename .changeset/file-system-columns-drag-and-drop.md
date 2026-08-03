---
"rn-motion-ui": minor
---

FileSystemColumnsView: cross-column drag and drop

`FileSystemColumnsView` now accepts `draggable` and `onMove` props. When enabled, items can be dragged across columns and dropped onto any valid folder target or a column's root. The ghost preview chip tracks the pointer; row and column ring highlights indicate valid drop targets.

- New hook `useFileSystemColumnsDrag` manages the cross-column drag session (mirrors the single-pane `useFileSystemDrag` architecture: hot-path state in refs, one `setState` per visual event).
- `FileSystemColumn` gains `dragState` and `onScrollOffsetChange` props so the view can push resolved drag state down and collect per-column scroll offsets for hit-testing.
- Geometry constants `COLUMN_ROW_HEIGHT`, `COLUMN_ROW_STRIDE`, `COLUMN_PADDING`, and the `columnRowHitAt` hit-test helper are now exported from `file-system-column`.
- `isValidDropTarget` and `movableSources` are now exported from `use-file-system-drag` for reuse by the columns hook.
- `FS_DRAG_CONTAINER_TEST_ID` gains a `column` key.
