---
'rn-motion-ui': patch
---

fix(gestures): claim the pan at hold so a held item dragged vertically lifts instead of scrolling

On native, a held `<FileSystem draggable>` row inside a vertical `ScrollView` scrolled
when dragged straight down — the drag only lifted on horizontal movement. The pan
transport waited for the finger to travel past `escapeSlop` (24px) before calling
`manager.activate()`, but the native scroll begins at ~10px, so the scroll claimed the
vertical movement and cancelled the pan first.

The pan now claims the finger the moment the press commits (past `armDelay`),
activating the gesture to take the vertical movement off the enclosing `ScrollView`,
while the drag itself still lifts on the move past `slop`/`escapeSlop`. Claiming and
lifting are two separate `PanArm` flags (`active` vs `dragging`) so the hold that arms
the drag never becomes a drag on its own — a bare hold keeps opening its context menu
exactly as before.
