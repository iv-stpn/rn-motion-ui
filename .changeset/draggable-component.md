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

Three transports sit behind that one contract, each the one actually native to
where it runs. A mouse on web rides a real HTML5 drag rather than a synthesized
one, and hands the browser's own `DataTransfer` straight through — which is what
makes the payload cross to code that has never heard of this component: an
existing `dragover`/`drop` listener, or `<FileSystem onExternalDrop>`, receives
these drags with no adapter. Touch on web gets a pointer-driven pan instead,
because mobile browsers fire no HTML5 drag for touch at all and the component
would otherwise simply not work on a phone. Native arms an RNGH pan. Both pans
wait out a 300ms hold, matching the context-menu hold so the two never both fire,
and draw a ghost that follows the finger. `transports` pins the choice when you
need to: `'pan'` keeps a drag inside the library with a uniform ghost and no OS
drag session, `'html5'` opts a component out of touch dragging.

`onDragEnd` reports the platform's verdict instead of guessing: `dropEffect` is
what a zone claimed, and `canceled` is `dropEffect === 'none'` on both sides. A
native zone claims a drag exactly as a browser one does, by writing
`transfer.dropEffect` while the drag is over it.

The ref is a `DraggableHandle`: `isDragging()`, `getTransfer()`, `getNode()`,
`measure()` (a promise on both platforms, since native's `measureInWindow` is
callback-based), and `cancel()`. `cancel()` is honestly partial on web — once the
browser owns a drag, only the user can end it, so it clears component state and
the store's session while the browser's drag image keeps following the cursor.

`groups` names what this drag is, and a `<Dragzone>` takes it when their labels
intersect — omit them on both sides and everything matches everything, which is
the right default for a tree with one kind of drag in it. See the drag system
changeset for the receiving half.

A drag is pointer-only on both platforms, so anything expressed only as a drag
needs a second non-pointer path to the same outcome. New types:
`DraggableProps`, `DraggableTransports`, `DraggableHandle`, `DragTransfer`,
`DragStartEvent`, `DragMoveEvent`, `DragEndEvent`, `DragPoint`, `DragRect`,
`DragDropEffect`, `DragEffectAllowed`, `DragGroups`.
