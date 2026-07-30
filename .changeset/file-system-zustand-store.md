---
"rn-motion-ui": patch
---

`FileSystem`: migrate internal state from React Context to per-instance Zustand store

No public API change. Each `FileSystem` mount now owns a `createStore`-based Zustand store instead of a single React Context value, so sibling instances never share state and re-renders are limited to the slices that actually changed (`useShallow` on every slice hook).

The old `use-file-system`, `use-file-system-filters`, and `use-file-open` internal hooks are removed; all consumers now call the new granular slice hooks (`useFileSystemNavigation`, `useFileSystemEntries`, `useFileSystemSearch`, `useFileSystemFilters`, `useFileSystemSelection`, `useFileSystemViewer`, `useFileSystemLayout`, `useFileSystemConsumer`) and their matching action hooks.
