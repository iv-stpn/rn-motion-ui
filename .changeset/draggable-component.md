---
"rn-motion-ui": minor
---

**Draggable**: one grab-and-carry wrapper for web and native.

Making something draggable meant writing the platform down. On web you set
`draggable` on a DOM node and ride the HTML5 events — and under
react-native-web you cannot even do that from JSX, because `View` drops unknown
HTML attributes, so it took a `useEffect` reaching for `ref.current` as an
`HTMLElement`. On native there is no such API at all, so you wired a pan gesture
by hand. `Draggable` is that work done once:

```tsx
<Draggable
  data={{ 'application/x-my-item': JSON.stringify(item) }}
  effectAllowed="copy"
  onDragEnd={({ canceled, transfer }) => {
    if (!canceled) console.log(transfer.getData('application/x-my-item'));
  }}
>
  <Chip label={item.name} />
</Draggable>
```

`data` is a MIME-keyed payload, written into the transfer when the drag starts.
`onDragStart`/`onDragMove`/`onDragEnd` fire the same shapes on both platforms,
with points in window coordinates.

Web rides a real HTML5 drag rather than synthesizing one, and hands the browser's
own `DataTransfer` straight through. That is what makes the payload cross to code
that has never heard of this component: an existing `dragover`/`drop` listener,
or `<FileSystem onExternalDrop>`, receives these drags with no adapter. Native
arms a pan after a 300ms hold (matching the context-menu hold, so the two never
both fire), draws a ghost that follows the finger, and publishes the drag to a
small registry a drop zone can subscribe to — the stand-in for the OS drag
session native does not have.

`onDragEnd` reports the platform's verdict instead of guessing: `dropEffect` is
what a zone claimed, and `canceled` is `dropEffect === 'none'` on both sides. A
native zone claims a drag exactly as a browser one does, by writing
`transfer.dropEffect` while the drag is over it.

The ref is a `DraggableHandle`: `isDragging()`, `getTransfer()`, `getNode()`,
`measure()` (a promise on both platforms, since native's `measureInWindow` is
callback-based), and `cancel()`. `cancel()` is honestly partial on web — once the
browser owns a drag, only the user can end it, so it clears component state and
the registry entry while the browser's drag image keeps following the cursor.

A drag is pointer-only on both platforms, so anything expressed only as a drag
needs a second non-pointer path to the same outcome. New types:
`DraggableProps`, `DraggableHandle`, `DragTransfer`, `DragStartEvent`,
`DragMoveEvent`, `DragEndEvent`, `DragPoint`, `DragRect`, `DragDropEffect`,
`DragEffectAllowed`.
