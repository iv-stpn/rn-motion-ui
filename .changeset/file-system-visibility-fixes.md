---
"rn-motion-ui": patch
---

fix(FileSystem): correct search and subfolder scoping in `computeVisiblePaths`

- Match search query against `entry.name` instead of the entry path — id-based paths don't embed the display name so the old path-substring test eliminated every result on any non-empty query.
- Replace `path.startsWith(currentPath)` with a `parentPath` chain walk through the index — flat parentPath manifests assign each entry a single-segment id path, so string-prefix containment never held for nested folders.
- Apply the same `parentPath`-aware ancestor walk in `markVisible` so highlighted entries correctly bubble up to the current folder in flat manifests.
