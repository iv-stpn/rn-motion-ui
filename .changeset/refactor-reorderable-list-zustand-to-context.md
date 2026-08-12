---
"rn-motion-ui": patch
---

**ReorderableList: replace Zustand store with React context**

`ReorderableList` previously held its drag state in a per-instance Zustand store registered in a module-level `Map` keyed by `listId`, with `<ReorderableItem>` reading state and actions through a `useReorderableListStore(listId, selector)` lookup. That indirection is gone: state now lives in a React context provided by the list view, and items read it via a `useReorderableList()` hook — no global registry, no `syncConfig`/teardown round-trip, and no thrown lookups when a store was absent.

The drag bookkeeping is split along the same render/non-render boundary the old store used: `draggedKey` and `indicatorIndex` are React state (they drive the dimmed item and the insertion indicator), while `overKey`, `insertBefore`, and the measured rects stay in refs behind stable `useCallback` actions. `computeIndicatorIndex` moves into `reorderable-list-reorder.ts` alongside the other pure reorder math.
