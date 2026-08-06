---
"rn-motion-ui": minor
---

**MultiDragManager, MultiDraggable**: drag a selection, not an item.

`<Draggable>` knows what it holds and nothing about the list it sits in. So
dragging one of three selected rows moves one row — the other two stay put,
because no single draggable was ever told they existed. Every list with
multi-select ends up re-deriving the same three things to fix that: which ids a
lift should carry, one payload built from all of them, and a way for the members
left behind to know they are moving too.

```tsx
<MultiDragManager
  selectedIds={selected}
  getGroupData={(ids) => ({ 'application/x-rows': JSON.stringify(ids) })}
  renderPreview={(ids) => <Chip label={`${ids.length} items`} />}
>
  {rows.map((row) => (
    <MultiDraggable id={row.id} key={row.id}>
      <Row row={row} dimmed={useIsLifting(row.id)} />
    </MultiDraggable>
  ))}
  <Dragzone onDrop={({ transfer }) => move(readMultiDragIds(transfer))} />
</MultiDragManager>
```

Lifting a selected item carries every selected id; lifting an unselected one
carries just it and leaves the selection alone. That rule is `resolveIds`, and
the default is the one a file manager, a mail list and a canvas all want —
replace it for a list where it is not.

The ids in flight are read back off the drag's own transfer rather than recorded
at lift time, which is what keeps them right on every transport and after a
cancel: nothing to clean up, because the set empties when the drag does.
`useIsLifting(id)` is how a member that is *not* under the pointer knows it is
nonetheless moving — the hook that fades the rest of the selection.

The group also travels as `application/x-multi-drag-ids` on the transfer, so a
plain `<Dragzone onDrop>` reads it with `readMultiDragIds` — and under the HTML5
mouse transport, so does a `drop` listener that has never heard of this library.
`withMultiDragIds` adds the same key to a payload you are building yourself.

It is a `<DragManager>` underneath, with all of its props: zones, isolation,
groups and the ghost overlay behave exactly the same. `renderPreview` draws the
group ghost for the pan transports; under HTML5 the browser draws its own drag
image and it is not consulted.

A multi-select drag needs its keyboard equivalent more than a single one, since
the selection it acts on is already reachable without a pointer — a "Move
selected to…" command belongs next to the `onDrop` that performs it.

New subpaths: `rn-motion-ui/multi-drag-manager`, `rn-motion-ui/multi-draggable`,
`rn-motion-ui/multi-drag` and `rn-motion-ui/multi-drag-scope`. New types:
`MultiDragManagerProps`, `MultiDraggableProps`, `MultiDragIdResolver`,
`MultiDragScope`.
