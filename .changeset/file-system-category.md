---
"rn-motion-ui": patch
---

Separate `FileSystem` and `FileIcon` into their own `file-system` category.

- Moves `FileSystem` out of `display` into a new top-level `file-system` category
- Extracts `FileTypeIcon`, `FileSystemFolderGlyph` and their supporting utilities into a standalone `FileIcon` component at `./file-icon`
- Storybook titles updated to `File System/FileSystem` and `File System/FileIcon`
- No API changes; existing `./file-system` and new `./file-icon` export paths are stable
