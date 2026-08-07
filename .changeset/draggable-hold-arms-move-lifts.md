---
"rn-motion-ui": patch
---

fix(Draggable, FileSystem): one press, three outcomes — a tap, a hold, or a drag, arbitrated in one place

Holding an entry in `<FileSystem draggable>` did nothing on touch: the context menu never opened. Right-click on web was unaffected, which is why this only ever showed up on native and on web touch.

The cause was two timers in two different gesture systems with nothing arbitrating between them. Both pan transports started the drag straight off their own 300ms hold timer, and RNGH cancels the touches under an activating handler — so at t=300 the entry's `Pressable` lost its long-press timer, which under `trigger="passive"` is the only way into the menu. The drag always won, 200ms before the press could fire.

`<Draggable>` now owns the whole timeline, because it is the only thing that sees every touch, and reports the outcomes it does not keep:

- **`onHold`** — the press stayed down past the hold delay without travelling. Open a menu, toggle a selection, start a preview.
- **`onHoldEscape`** — a drag took the gesture back off a hold that had already fired. Undo what the hold did.

The press reads in three phases, off four numbers both transports share so the gesture feels identical on either:

| | |
|---|---|
| before `armDelay` (150ms) | movement belongs to the scroll — the pan gives the gesture up, so a list inside stays scrollable |
| after it | `slop` (10px) of travel lifts a drag |
| at `holdDelay` (300ms), still still | `onHold` fires, and no drag lifts from this press unless it travels `escapeSlop` (24px) |

The last row is the escape hatch: whatever the hold put on screen is under the finger by then, so getting out from under it takes a deliberate shove rather than the drift of a hand that thought it had finished.

Those four numbers are not one set. They default per platform and are overridable per platform, through `behavior` on `<Draggable>` or once for a whole subtree on `<DragManager>`, in `Platform.select` vocabulary — flat fields everywhere, `native` for everything but web, then a block per OS:

```tsx
<DragManager behavior={{ armDelay: 100, android: { slop: 12 }, ios: { holdDelay: 400 } }}>
```

**Web, macOS and Windows default to no hold at all** (`holdDelay: null`, so no timer is armed and `onHold` never fires). A desktop already has a gesture for "tell me about this thing" and it is the right button; on web, a long press on touch is already the browser's own text selection and context menu, and a second meaning layered on top fights both. The arm window stays even there, because web touch still shares the surface with the page's scroll. **Android tightens `slop` to 8px and `escapeSlop` to 20px**, matching `ViewConfiguration`'s scaled touch slop where iOS follows UIKit's more forgiving 10pt.

The resolver is pure and separately tested: `resolveDragBehavior(behavior, os)` flattens the whole thing to four numbers, `DRAG_TUNING_DEFAULTS` is the per-OS table, and `useDragBehavior` resolves against the running platform. Everything downstream reads those numbers and never asks which OS it is on again.

### `useDraggable`, and a `<Draggable>` that draws nothing

The drag is now available without the wrapper's markup. `useDraggable()` is the whole of `<Draggable>` bar the three elements it renders — transport selection, the press timeline, the session, store registration, the measured rect, the handle — exposed as `getRootProps()` / `getGhostProps()` plus `gesture` for the `GestureDetector` a hook cannot render itself. For a row in a `FlatList` that must not gain a wrapper `View`, or a `Pressable` host, or a ghost drawn a different way.

`<Draggable>` stays, as that hook plus a `View`, and **has lost its own styling**: no `cursor-grab`, no `cursor-grabbing`, no lifted state. `className` and `style` land on the host untouched. The replacement is `isDragging`, now reactive render state rather than only the imperative `handle.isDragging()` — and true under every transport, including the ones that draw no ghost here. The one style the hook still supplies is `userSelect: 'none'` on web, which is functional: without it a drag starting on text selects the text instead of lifting.

Native switches from `activateAfterLongPress(300)` to `Gesture.Pan().manualActivation(true)`, with the phase decision in `onTouchesDown`/`onTouchesMove` worklets. That prop cannot express this gesture: it flips to ACTIVE off a timer without consulting distance, and *fails* the pan if the finger travels first.

In `FileSystem`, `useEntryHold` replaces `useEntryLongPress` and reconciles all three claimants on an entry — the tap, multi-selection, and the context menu. Multi-selection still wins the hold when `selectionMode="multiple"`, as before. Both hold paths stay wired (the pans see touch, the `Pressable` sees a mouse) and the first to fire locks the other out for that gesture, so a hold cannot run its action twice — which for a selection toggle meant undoing itself. A release that already produced a hold no longer counts as a tap, so the entry behind an open panel is not also selected.

An entry stays a drag source while its own context menu is open, which is what makes the escape possible: the finger that opened the menu is still delivering to the view it started in, so that entry's own pan is what detects the shove and closes the panel.

### `Holdable` and `HoldDraggable`

Two new components exposing the same timeline without requiring a `<DragManager>`:

**`<Holdable>`** — hold only, no drag. Wraps children in the four-phase press timeline (pending → active → hold) and exposes the current state via a render-prop child:

```tsx
<Holdable onHold={() => select(id)}>
  {({ isPressed, isHeld }) => (
    <Chip pressed={isPressed} selected={isHeld} label={name} />
  )}
</Holdable>
```

`isPressed` flips at `armDelay`; `onHold` fires at `holdDelay`. A cancel or release ends the press quietly — `onHoldEscape` is a drag's crossing out of a fired hold, and a bare `<Holdable>` has nothing to drag, so it never reports one (the prop exists so a consumer can move between `<Holdable>` and `<HoldDraggable>` without rewiring). The hold defaults fire on every platform (unlike `<Draggable>`, which has no hold on web by default) — but a mouse press still does nothing: a held left button is a text selection and a held right button is the context menu; the hold-and-lift is a touch idiom.

**`<HoldDraggable>`** — hold + drag in one. Identical to `<Draggable trackPhase>` but with the render-prop always enabled, so the child always gets a live phase without a separate state lift:

```tsx
<HoldDraggable
  data={{ 'application/x-item': item.id }}
  onHold={() => openMenu(item)}
  onHoldEscape={closeMenu}
>
  {({ isPressed, isHeld }) => (
    <Row row={item} pressed={isPressed} selected={isHeld} />
  )}
</HoldDraggable>
```

Web's drag transport defaults to `holdDelay: null`, so `onHold` on web needs `behavior={{ holdDelay: 300 }}` (or a platform-specific `web: { holdDelay: 300 }` block) to fire. Touch on web and all native platforms hold by default.

### `HoldContextMenu` — hold gesture rebuilt on `Holdable`

`HoldContextMenu` no longer drives the squeeze animation from `Pressable.onLongPress`. On native for `activateOn="hold"`, the trigger is now a `<Holdable>` (or a `<HoldDraggable>` when `dragOptions` is set), and the squeeze fills exactly the gap between `armDelay` and `holdDelay` from the resolved tuning.

Two new props:

- **`behavior?: DragBehavior`** — timing and slop overrides forwarded to the gesture widget; merged with `holdDuration` if given.
- **`dragOptions?: HoldContextMenuDragOptions`** — upgrades the hold gesture to `<HoldDraggable>`. A move past `escapeSlop` after arming lifts a drag; the hold still opens the menu, and an escape closes it before the drag takes over. Works wherever the hold does: native, and touch on web. A desktop mouse keeps the right-click, whose dropdown has no gesture to escape from.

### Touch on the web: the gesture now survives the browser's own ideas

Three fights with the browser's touch pipeline, each found by driving the real
gesture with real input rather than synthetic events:

- **A hold that fired no longer "clicks" on release.** The browser synthesizes
  `mousedown`/`click` at the release point after `touchend` — and with a hold
  menu open, the topmost element there is the menu's own scrim, so the phantom
  click dismissed the menu the instant the finger lifted. Both pointer
  transports now cancel the `touchend` of a press that reached its hold, which
  is the documented way to suppress the compat events.
- **The drag no longer dies one move after it lifts.** Taking explicit pointer
  capture at the lift releases the touch's implicit capture on the child under
  the finger, and that `lostpointercapture` *bubbles* — the transport read its
  own capture handoff as "the system took the pointer" and cancelled the drag
  it had just started. A capture loss now only aborts the trip when it happens
  on the captured node itself.
- **Chromium's native drag is refused while the pan owns the press.** A touch
  long-press on any `draggable=true` element starts a *native* HTML5 drag,
  cancelling the pointer stream under the pan. The HTML5 transport now
  `preventDefault`s that `dragstart` whenever the press timeline is mid-gesture
  — and once a hold has fired, `touchmove` is cancelled from the first move, so
  the escape's opening travel cannot be read as a scroll either.

