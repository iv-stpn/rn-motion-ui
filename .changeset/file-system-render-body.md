---
"rn-motion-ui": minor
---

feat(FileSystem): `renderBody` slot for wrapping the file area

`renderBody` decorates the file area instead of replacing it. Where `renderHeader` and `renderFooter` hand you a state snapshot and take whatever you return, this one also hands you `state.content` — the active view, or the empty/loading placeholder standing in for it — so a drop hint, an upload overlay or a details rail can sit alongside the four views without reimplementing any of them. Returning `state.content` unchanged is a no-op.

```tsx
<FileSystem
  renderBody={({ content, isEmpty }) => (
    <View className="flex-1">
      {content}
      {isEmpty ? <DropHint /> : null}
    </View>
  )}
/>
```

The snapshot is the state that produced the content — `currentPath`, `entries`, `view`, `selectedEntry`, `searchValue`, `isSearching`, `hasActiveFilters`, `isLoadingCurrentFolder`, `isEmpty` — exported as `FileSystemBodyState`, so a wrapper tracks the same selection and folder the views do without recomputing any of it.

`isEmpty` is not the same as "the placeholder is showing": the columns view keeps its panes over an empty folder, since that is how Finder lets you walk back up a trail, so it only yields to the placeholder while searching or filtering.

Unlike the header and footer slots, `renderBody` is **called as a plain function rather than mounted as a component**. An inline arrow is a new function identity on every render, and a component whose *type* changes remounts its entire subtree — here that subtree is the active view, so every keystroke in the search field would have reset its scroll offset, its panes and any in-flight drag. Calling it keeps the returned elements in the parent's own tree, where reconciliation compares them by position as usual. The consequence for callers: don't call hooks directly inside `renderBody` — put them in a component you render inside the returned tree.

The wrapper renders *inside* the file-area node rather than around it, so `bodyClassName` still applies and the area keeps its flex sizing and web text-selection guard however you nest things. Give the returned tree `flex-1` (or `size-full`) if it should fill the area the way the built-in views do.
