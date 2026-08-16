---
'rn-motion-ui': patch
---

fix(ui): FileSystem — nested vertical scroll on the desktop list, icons, columns, gallery and search views

The mobile list/grid scroll fix (4abdf8d4) only touched the two mobile views;
the remaining vertically-scrolling surfaces were still inert on Android when
mounted inside a consumer `ScrollView`.

- Every vertical `ScrollView`/`FlatList` now sets `nestedScrollEnabled={true}` —
  the desktop list, the icons grid, the columns pane, the gallery sidebar and
  the search results. Android only scrolls a scrollable nested inside a scroll
  container when it opts into nested scrolling.
- The `FlatList`s (desktop list, columns pane, search) also set
  `removeClippedSubviews={false}`: Android defaults it to `true`, which wrongly
  detaches visible cells when the list is nested in a `ScrollView` — the same
  failure mode the `Table` fix (348ad09c) addressed.
