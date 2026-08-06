---
"rn-motion-ui": patch
---

fix(Draggable, FileSystem): a hold that never moves no longer becomes a drag, so a held entry can open its context menu again

Holding an entry in `<FileSystem draggable>` did nothing on touch — the context menu never opened. Right-click on web was unaffected, which is why this only ever showed up on native and on web touch.

Both pan transports started the drag straight off their 300ms hold timer. RNGH cancels the touches under an activating handler, so at t=300 the entry's `Pressable` lost its own long-press timer — and `Pressable.onLongPress` is the only way into the menu under `trigger="passive"`. The drag always won, 200ms before the press could fire.

The hold now only *arms* the drag; the first move past a slop threshold lifts it. A finger that holds and stays put belongs to whatever else is watching the press. That makes the "a press resolves to one or the other but never both" rule true by construction instead of by two timers being set to the same number:

- **native**: `Gesture.Pan().manualActivation(true)` with the arm/lift decision in `onTouchesDown`/`onTouchesMove` worklets, replacing `activateAfterLongPress(300)`. That prop cannot express this gesture — it flips to ACTIVE off a timer without consulting distance, and *fails* the pan if the finger travels first.
- **web touch**: the pointer transport arms on its timer and captures the pointer at the lift rather than at the hold, so a bare hold's events stay on the node they started on where the press responder can still see them.

Travel before the hold lands still means "this was a scroll" and gives the gesture up, as before.

An entry also stops being a drag source while its own context menu is open: on touch the finger that opened the menu is still down, and a few pixels of drift would otherwise lift a drag out from under a panel that is already showing. It stays a drop *target* — another entry's drag can land on that folder either way.

No API change. `DRAG_ARM_SLOP` and `DRAG_MOVE_SLOP` join `DRAG_HOLD_MS` as the timing/threshold constants both transports share.
