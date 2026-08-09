---
"rn-motion-ui": minor
---

**New `SortableList` component**

A drag-to-reorder list where items visually reorder in real-time during the drag — the dragged item is dimmed at its preview position while other items animate to close the gap or make room.

Built on the existing gesture primitives (`Draggable`, `Dragzone`, `DragManager`), so it inherits their transport story and isolation model. Each item computes its visual position as a pure function of `(index, activeIndex, insertionIndex)` and animates `translateY` to reach it — no rect measurement, no FLIP snapshots, no tree reordering during the drag.

- New export: `rn-motion-ui/sortable-list`
- Requires a fixed `itemHeight` prop (every item must share the same height)
- Isolates itself inside a `<DragManager isolate>` — two lists on the same page are independent
- Supports `renderPreview` for a custom drag ghost
- The reorder commits on drop; cancelling reverts items to their original positions
