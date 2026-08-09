---
"rn-motion-ui": minor
---

**Rename `DnDList` → `ReorderableList`**

The `./dnd-list` export is replaced by `./reorderable-list`. All associated types and helpers are renamed accordingly:

- `DnDList` → `ReorderableList` — the main container component
- `DnDItem` → `ReorderableItem` — individual draggable rows
- `dndReorder` → `reorderableListReorder` — the reorder helper

Import from `rn-motion-ui/reorderable-list` instead of `rn-motion-ui/dnd-list`. The old path is removed.
