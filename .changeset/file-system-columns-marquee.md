---
"rn-motion-ui": patch
---

fix(FileSystem): the marquee works in the columns view, and no longer collapses the column it runs in

Two bugs stopped the selection box from being usable in `ColumnsView`.

It could not start. The web drag transport captured the pointer as soon as the
press passed the drag slop, then asked `begin()` whether there was anything to
drag. On empty space `begin()` returns false and the trip resets — but the capture
had already happened, so the column's marquee listener never saw the pointer it
was waiting for. Capture now happens after `begin()` confirms a source, which
leaves the pointer free for a child listener when the press lands on nothing. The
list and icons views run the same transport and gain the same ordering.

It collapsed the trail. Each column past the first exists because a folder is
selected in the column to its left, and a marquee replaces the selection with
whatever it covers. Sweeping inside a sub-column therefore deselected the parent
folder that opened it, and the column vanished from under the pointer mid-drag.
Each column now injects the trail paths into the marquee's base, so the folders
that opened it stay selected. Column 0 has no trail to protect and is unchanged.

`FileSystemColumn`'s `onClearSelection` is gone with this — an empty-space press
now resolves through the marquee, which reports an empty covered set and clears
the selection on its own. The component is internal, so the public API is
unchanged.
