---
"rn-motion-ui": minor
---

**Draggable: collision algorithms, axis constraint, drag bounds, and handle sub-component**

- New `collisionAlgorithm` prop (`'intersect'` | `'contain'` | `'center'`) switches zone hit testing from point-based to rect-vs-rect. The draggable's live rect (computed from its lift-time box offset by pointer delta) is tested against each zone's measured box using the chosen strategy. Falls back to the existing point-in-rect test when unset or when no `sourceRect` is available.
- New `dragAxis` prop (`'x'` | `'y'` | `'both'`) constrains pointer movement to a single axis during the drag. The ghost and zone targeting respect the clamped position; `onDragMove` still receives the raw (unclamped) point.
- New `dragBoundsRef` prop accepts a ref to a boundary `View`. The drag ghost is clamped inside that view's window-coordinate rect on every frame. Pan-transport only (touch on web, native); HTML5 drags are controlled by the browser.
- New `<Draggable.Handle>` sub-component restricts drag initiation to a sub-area. Multiple handles per draggable are supported; as long as at least one is mounted, the host's `GestureDetector` is suppressed.

**Dragzone: `skipRectMeasure` for programmatic hit testing**

Zones that compute hit testing through another mechanism (e.g. arithmetic position in `SortableList`) can now set `skipRectMeasure={true}`. The zone is never measured, never participates in measure sweeps, and always passes the spatial hit test — the consumer's `accepts` predicate is the sole gate.

**SortableList: Reanimated-powered UI-thread animations**

`SortableList` now drives item position animations entirely on the UI thread via `react-native-reanimated` shared values and `useAnimatedReaction`. Insertion index updates write directly to a `SharedValue` without triggering React re-renders; items read the shared values in worklets and animate `translateY` with `withTiming`. The commit (on drop) snaps items to their new canonical positions via a `dropVersion` shared value bump in a `useLayoutEffect` — the user never sees an intermediate frame. The `activeIndex` (for `renderItem`'s `isDragging` flag) stays as React state, so only the dragged item re-renders on lift/drop.
