---
"rn-motion-ui": patch
---

fix(HoverMenu): hover opens a pressable trigger, and a controlled `open` renders the panel

The hover pair was `Pressable`'s `onHoverIn`/`onHoverOut`. react-native-web
implements those with `useHover({ contain: true })`, which dispatches a bubbling
`react-gui:hover:lock` event on enter — and an ancestor using the same hook reads
a lock from a different target as its own hover-end. Every nested `Pressable`
therefore cancelled its ancestors' hover:

- A pressable trigger (a `Button`) fired the lock as the pointer reached it, so
  the wrapper's hover ended one tick after starting and `handleHoverOut` cleared
  the pending open timer. The menu only ever opened on press.
- `MenuItem` is a `Pressable` too, so moving onto an item ended the panel's hover
  and scheduled a close while the pointer was still inside it.

Both are now on `onPointerEnter`/`onPointerLeave` — plain DOM events with no lock
protocol, which fire once for the element-plus-descendants region and ignore
movement between children. That is exactly the wanted semantics, and a nested
pressable is invisible to them. RNW forwards both props to the DOM node and they
are part of RN's own `ViewProps`, so this stays type-safe and is inert on native,
where `canHover` gates it anyway.

Separately, a controlled `open` flipped from outside the menu left the panel
invisible. The panel renders on `open && rect`, and the trigger was only measured
on the paths the menu drives itself — the hover timer and `toggle`. A consumer
setting `open` from a keyboard shortcut, a switch, or a route change never touched
either, so `rect` stayed null. Measuring is now keyed on `open` becoming true,
whatever set it, which is also correct in general: the trigger may have moved since
the last measurement. `measure` bails on an identical rect so the extra pass costs
no re-render.
