---
"rn-motion-ui": minor
---

**FileSystem: search can be scoped to the open folder or to the whole tree.**
A query used to always run over the open folder's subtree, so finding something
you could not place meant navigating back to the root first and searching again.

`renderFilters` now hands the slot a scope it can offer as a control:

```tsx
renderFilters={({ folderName, isAtRoot, rootLabel, searchScope, setSearchScope }) => (
  <View className="flex-row items-center gap-1.5">
    <Text>Search:</Text>
    <Chip active={searchScope === 'root'} onPress={() => setSearchScope('root')}>
      {rootLabel}
    </Chip>
    {isAtRoot ? null : (
      <Chip active={searchScope === 'folder'} onPress={() => setSearchScope('folder')}>
        {folderName}
      </Chip>
    )}
  </View>
)}
```

- `searchScope` — `'folder'` (the open folder and everything under it, the
  previous behavior and still the default) or `'root'` (the whole manifest).
- `setSearchScope` — switches it, taking effect immediately on a live query with
  no debounce, since the press is the whole gesture.
- `rootLabel`, `folderName`, `isAtRoot` — enough to name both scopes and to know
  that at the root they are the same tree, so only one is worth offering.

The exported `FileSystemSearchScope` type is the union.

Two deliberate boundaries. Only a *query* widens: filters stay scoped to the
folder they are shown against whichever way the scope is set, because a filter
bar reads as being about the folder you are looking at. And the scope outlives a
query — navigating clears the query but keeps the scope armed, so switching to
root once does not have to be redone for every subsequent search.

Nothing changes for existing consumers: the default scope is what the component
already did, and a slot that ignores the new state keeps behaving exactly as it
did before.
