---
'rn-motion-ui': patch
---

fix(ui): SortableList — atomic drop commit kills reorder jitter; memoize item slots

- **Atomic drop commit (fixes reorder jitter).** The drop commit used to be
  split in two: `handleDragEnd` handed the reordered array to the consumer but
  deferred writing the shared `activeIndex`/`insertionIndex` values to a
  `useLayoutEffect` that ran only AFTER React re-rendered with the new
  canonical order. In that window every item whose `index` dependency changed
  re-initialized its animated reaction against the STALE drag-time indices —
  the item that now occupies the old active slot was misread as the active
  item and snapped to a multi-slot offset, and the dragged item computed a
  wrong shift target too — a large visible jitter on drop (native and web).
  The commit now writes ALL shared values to their final values synchronously
  in `handleDragEnd`, in the same JS tick as the `onReorder` call and before
  the re-render: `dropVersion` bumps (items snap, no `withTiming`), then
  `activeIndex`/`insertionIndex` reset to `-1` so every reaction re-init
  evaluates at its rest position (`translateY: 0`) at its new canonical
  index. The cancel and self-drop paths are unchanged: no version bump, and
  the reaction animates items back smoothly with `withTiming(200)`.
- **Memoized item slots (perf).** The list now renders each row through a
  module-scope `React.memo` wrapper whose comparator compares only
  (item identity, index, isDragging, disabled, testID) — deliberately not
  `children`/`preview`, which are pure functions of those inputs for an
  unmoved item. A reorder commit therefore re-renders only the moved items'
  `Dragzone`/`Draggable` subtrees instead of every row. `SortableItem`'s
  props/API are unchanged; `SortableList`'s public API is unchanged.
