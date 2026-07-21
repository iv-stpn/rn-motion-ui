---
"rn-motion-ui": minor
---

Table overhaul: pagination, load-more, infinite scroll, striped rows, sortable master switch, `getSortValue`, rich empty state. New `hasKey<K>` worklet typeguard.

**Table:**

- New `mode` prop (`'loadMore' | 'pagination' | 'infiniteScroll'`) controls the footer pattern.
- Pagination: `page`, `pageSize`, `total`, `onPageChange`, `paginationLabel` props; `PaginationFooter` rendered outside `FlatList` so it stays pinned.
- `loadingMore` prop shows a spinner + skeleton footer while a follow-up page is fetching.
- `striped` / `stripedStyle` props for alternating-row shading.
- `sortable` master switch — set to `false` to disable sort on all columns regardless of per-column flags.
- `TableColumn.getSortValue` — custom value extractor used during client-side sort; avoids sorting on rendered React nodes.
- `TableColumn.skeletonWidth` — configure the skeleton bar width per column.
- Rich empty state: `emptyIcon`, `emptyTitle`, `emptyDescription` props (used when `emptyState` is not provided).
- `onLoadMore` / `loadMoreLabel` for `loadMore` mode.
- `onEndReached` now only fires in `infiniteScroll` mode — prevents accidental triggers in other modes.
- `TableMode` type is now exported from the `table` entry point.
- `table-parts` entry: `TableCard`, `SkeletonFooter`, `PaginationFooter`, `LoadMoreFooter` extracted into their own file.

**Utils:**

- `hasKey<K>(obj, key)` typeguard added to `utils/typeguards` — annotated `'worklet'` for Reanimated UI thread use.
