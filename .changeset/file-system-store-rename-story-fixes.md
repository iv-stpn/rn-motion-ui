---
"rn-motion-ui": patch
---

**FileSystem store rename, story fixes for double-rendered children**

**FileSystem:** Internal rename of `s` → `fileSystemStore` in `ensureChildren` for readability.

**Stories:** FileSystem and HoldDraggable stories updated to use `findAllBy*` queries (`findAllByText`, `findAllByRole`, `findAllByTestId`) instead of `findBy*` / `getBy*` singletons. Components like `HoldContextMenu` and `Draggable` render children twice (functional copy + offscreen drag-preview ghost), so single-match queries reject. Each call picks the first (functional) copy, which is rendered first in document order.
