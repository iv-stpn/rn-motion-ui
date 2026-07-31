---
"rn-motion-ui": minor
---

`FileSystem`: multi-selection — Ctrl/Cmd-click, Shift-range, long-press, and a selection box

`selectionMode="multiple"` lets more than one entry be selected at a time, with the gestures a file browser is expected to have:

- **Ctrl-click** (Cmd-click on macOS), or a **long-press** on touch: toggle the entry under the pointer in or out of the selection.
- **Shift-click**: take the contiguous run from the anchor — the last entry picked without Shift — to the entry pressed. The anchor stays put, so shift-clicking around grows and shrinks one run rather than accumulating; hold Ctrl/Cmd as well to add the run to what is already selected.
- **A selection box** dragged across empty space in the grid view, web only. Everything the band touches is selected live as it is drawn; hold Ctrl/Cmd as you start it to add rather than replace.

A plain press still replaces the selection, and a press on the background still clears it. All four views paint the selection, and the status bar counts it with a Clear affordance once there is more than one.

The ordering a Shift-range runs through comes from the view you pressed, not from the store: the list view runs through its rows as drawn (an expanded folder's children included, since they sit between their parent and its next sibling), and the columns view keeps each pane to itself, so a range never jumps across the trail into a sibling folder.

The selected set arrives through a new `onSelectedItemsChange(items)`, in the order the entries were picked. `onSelectionChange(item)` is unchanged and now follows the *lead* — the entry added most recently — which is what the columns trail, the columns preview pane and the gallery stage keep showing. `renderBody` gains `selectedEntries`, and `renderFooter` gains `selectedCount` and `clearSelection`.

Dragging an entry that belongs to a multi-selection now moves the whole selection: `onMove` reports every path in one `sources` array instead of firing per entry. Members the drop would not actually move — the destination itself, entries already inside it, a folder dropped into its own subtree — are filtered out first, and nothing fires when that leaves the list empty. Dragging an *unselected* entry is still a single-entry drag.

Two things to know before switching it on:

- Long-press is already the entry context menu's trigger on touch, and multi-selection takes it over. With `getContextMenuActions` the menu still opens on right-click on web, but on touch it becomes unreachable — so pick one, or surface those actions elsewhere.
- With `draggable`, a hold on native starts a drag (at 300 ms) before a long press resolves (at 500 ms), so the toggle gesture is effectively web-only in the list and icons views.

Two fixes fall out of the same work, and apply whatever `selectionMode` is set to:

- Entry rows and tiles now carry `aria-selected`. They only ever set `accessibilityState={{ selected }}`, which react-native-web does not map to anything, so on web the highlight fill was the only thing saying an entry was picked — assistive tech was told nothing at all.
- A drag in the grid view now only lifts a tile when the press actually landed on one. It used to resolve the press to the *nearest* tile, so a press in the padding or in a gutter between tiles would lift a neighbour you had not touched.

The default is `selectionMode="single"`, which behaves exactly as before — except that re-selecting the entry you had already selected before navigating away and back no longer fires a duplicate `onSelectionChange`.
