---
"rn-motion-ui": minor
---

**ReorderableList: remove ghost mode (indicator-only)**

`ReorderableList` is now indicator-mode only. The `mode` prop, `renderPreview` prop, and all ghost-mode state (`previewKeys`, `ghostKey`, `flipRects`, `movedKey`) are removed.

- **Breaking:** `mode` prop removed — `'ghost'` is no longer accepted
- **Breaking:** `renderPreview` prop removed
- FLIP animation system removed (Animated.View wrappers, `measureInWindow` tracking, easing curves)
- Items now render in plain `View` wrappers instead of `Animated.View`
- `ReorderableItem` adds a mount-time measure effect so zone rects are populated before a drag can land
- `isPastThreshold` helper removed from `reorderable-list-reorder`; `insertionPosition` no longer accepts `ghostHeight`

For real-time visual reordering during drag, use the new `SortableList` component (`rn-motion-ui/sortable-list`).
