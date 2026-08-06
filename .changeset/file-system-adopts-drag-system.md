---
"rn-motion-ui": minor
---

**FileSystem**: drag and drop now runs on `Draggable`/`Dragzone`/`MultiDragManager`.

Every view had brought its own drag. The list and icons grids shared one hook, the
columns pane had a second one that mirrored its architecture, web had a third for
the HTML5 half and external drops a fourth — five hooks, each measuring boxes,
hit-testing points and tracking a session, and each with its own idea of which
folder a release belonged to. Adding a view meant writing a sixth.

They are gone, replaced by the components the library already ships. An entry is a
`<MultiDraggable>`, a folder is a `<Dragzone>`, and the panes and the background are
zones too — so the ladder a drop falls down (entry, then the column under it, then
the open folder) is expressed as zone priority rather than as branches inside a
resolver. `props` are unchanged: `draggable`, `onMove` and `onExternalDrop` mean
exactly what they did.

What changes is behaviour that used to differ per view, and now cannot:

- **The three draggable views drag identically** — list, icons and columns — because
  none of them implements dragging any more. They resolve a drop through one hit
  test rather than three that agreed by hand.
- **A multi-select drag carries the selection**, via `MultiDragManager`: drag one of
  three selected rows and all three move. The members left behind fade, and lifting
  an unselected entry still moves just it.
- **Autoscroll while dragging near an edge** now works in the columns panes too,
  each scrolling on its own, where before only the list and icons grid had it.
- **A drop is resolved from measured boxes**, so a touch pan and a mouse drag land
  on the same folder. Previously the web path read the DOM `drop` target and the
  pan path hit-tested rows, which could disagree at a row boundary.

Two fixes fall out of the same work:

- **`onExternalDrop` now fires for an in-library `<Draggable>` from elsewhere on the
  page**, not just for an OS file drag. Its documented contract always covered "a
  custom element on the page that sets drag data"; a payload with no FileSystem
  entries in it is foreign whether or not this library started the drag, and it
  reaches the consumer either way.
- **The hover highlight stands down for the length of a drag**, in the list, icons
  and columns views alike, so it cannot mark one cell while a zone outlines
  another. It comes back on the first pointer move after the drop. A mouse drag is
  an HTML5 drag and the browser stops the pointer stream while one runs, so the
  highlight now takes the lift itself as its cue rather than waiting for a
  `pointercancel` that not every engine sends.

`FS_DRAG_CONTAINER_TEST_ID` still names each draggable view's scroll surface, and
every entry answers to `<root>-entry-<path>` in all four views. The internal hooks
`useFileSystemDrag`, `useFileSystemColumnsDrag`, `useFileSystemIconsDrag`,
`useFileSystemDragWeb` and `useFileSystemExternalDrop` are deleted; none was
exported from the package.
