---
"rn-motion-ui": minor
---

**HoldContextMenu**: `trigger="passive"`, and a controlled `open`.

The component has always owned the press: it wraps `children` in a `Pressable`,
reads the gesture `activateOn` names, and squeezes under the finger. That is the
wrong shape when the children are already a button, or already own a long-press —
you get a second button nested in the first, an extra tab stop per item in a long
list, and on native two press responders competing for the same touch.

`trigger="passive"` drops the `Pressable` entirely. What is left is the measured
wrapper the panel anchors to, and the host opens the menu itself:

```tsx
const [open, setOpen] = useState(false);

<HoldContextMenu items={items} open={open} onOpenChange={setOpen} trigger="passive">
  <Pressable onPress={() => setOpen(true)}>
    <Text>Open menu</Text>
  </Pressable>
</HoldContextMenu>;
```

`open` makes the component controlled and works under either trigger mode. The
anchor is measured when it flips true, so a host can open the menu without a
gesture having measured anything first — the panel paints one commit later, once
that measurement lands. Leave `open` out and the trigger keeps the state, exactly
as before.

Two things survive the missing `Pressable`. Web's right-click still opens the
panel: the `contextmenu` listener sits on the wrapper and the event bubbles to it
from whatever the children render, so keyboard users reach the menu through
Shift+F10 without extra wiring. And nothing squeezes — the press it previewed
belongs to someone else now — so the lifted copy springs from rest rather than
from `HOLD_ITEM_SCALE`, which would otherwise read as a 5% pop out of an item the
user never touched.

New: `wrapperRef`, which hands you the measured node — a real DOM element on web —
for attaching your own listeners to it. New type: `HoldContextMenuTriggerMode`.
