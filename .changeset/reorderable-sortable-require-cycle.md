---
'rn-motion-ui': patch
---

refactor(ui): co-locate ReorderableItem and SortableItem into their list modules

- **Removes two require cycles.** `reorderable-list.tsx` ↔ `reorderable-item.tsx`
  and `sortable-list.tsx` ↔ `sortable-item.tsx` each formed a circular import —
  the item component reads its list's `useReorderableList`/`useSortableList` hook
  while the list renders the item, so the bundler warned about potentially
  uninitialized values at module-init. Both item components (never part of the
  public API) are now co-located in their list file, eliminating the cycle. No
  public API or behaviour change.
