---
"rn-motion-ui": minor
---

**FileSystem**: `isLoadingCurrentFolder` is now `isLoading`.

**Breaking.** The field named the folder it was about, which every other field in
the same snapshot also is — `currentPath`, `entries` and `hasActiveFilters` are
all the current folder's, and none of them say so. The qualifier only made this
one longer.

`FileSystemBodyState.isLoadingCurrentFolder` → `isLoading`, which is what
`renderBody` receives:

```tsx
// Before
<FileSystem renderBody={({ content, isLoadingCurrentFolder }) => …} />

// After
<FileSystem renderBody={({ content, isLoading }) => …} />
```

Same value, same meaning: `true` while the current folder's children are being
fetched. Nothing else about the snapshot changes, and a slot that never read the
field is unaffected.
