---
"rn-motion-ui": minor
---

`FileSystem`: new `renderEmptyState` slot

Replaces the placeholder that stands in for the file area when there is nothing to show, so "This folder is empty" is no longer the only option. `args.reason` says which of the four cases you are drawing — `'empty-folder'`, `'no-search-results'`, `'no-filter-matches'`, or `'loading'` — and `args.label` carries the copy the built-in placeholder would have used, ready to reuse. The rest of the args (`currentPath`, `folderName`, `view`, `searchValue`, `isSearching`, `hasActiveFilters`) describe the state that emptied it.

The slot is per-reason rather than all-or-nothing: return `undefined` to fall through to the built-in placeholder for that state, so you can take over the empty folder and leave the loading spinner and the no-results message alone. Return `null` to draw nothing.

Like `renderBody`, it is called as a plain function rather than rendered as a component — don't call hooks directly in it, put them in a component you render inside the returned tree.

```tsx
<FileSystem
  items={items}
  renderEmptyState={({ reason, folderName }) =>
    reason === 'empty-folder' ? <DropZone folder={folderName} onPick={upload} /> : undefined
  }
/>
```

`FileSystemEmptyStateArgs` and `FileSystemEmptyStateReason` are exported alongside it. Whatever the slot returns is mounted in the same background surface the built-in placeholder uses, so `getBackgroundContextMenuActions` still opens over it.
