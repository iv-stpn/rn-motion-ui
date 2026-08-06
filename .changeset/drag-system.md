---
"rn-motion-ui": minor
---

**Dragzone, DragManager**: the receiving half, so a drag can mean something.

`Draggable` could carry a payload but had nowhere to put it: you got points in
window coordinates and wrote the hit testing yourself, per screen, per platform.
Two components close that, and they compose rather than nest — a source and a
zone find each other through one module-level store, so a pair of them works with
no provider anywhere above:

```tsx
<Draggable data={{ 'application/x-card': card.id }} groups={['cards']}>
  <Card {...card} />
</Draggable>

<Dragzone groups={['cards']} overClassName="border-info bg-info/10" onDrop={({ transfer }) => move(transfer.getData('application/x-card'))}>
  <Column />
</Dragzone>
```

`groups` is the whole compatibility mechanism, and eligibility and acceptance are
one predicate rather than two: the same check that lights a zone up decides whether
it takes the release, so a zone cannot highlight and then refuse. `accepts` gets
the last word for a rule only the payload knows, `disabled` removes a zone from
the decision entirely, and `eligibleClassName`/`overClassName` — or the render-prop
form, `{(state) => …}` — handle the affordance without a state machine of your own.

**One authority on both platforms.** Zones publish their measured boxes to the
store and the store hit-tests points against them, so a native pan and a browser
drag resolve a drop through the same code. Overlap is settled without
configuration: explicit `priority`, then nesting depth, then the smaller box, then
mount order — which is what makes a trash can inside a board work with neither
side declaring anything. `priority` is there for when the geometry does not say
what you meant.

`<DragManager>` is optional, and adds the four things that need a *place* in the
tree to mean anything: a default group for its whole subtree, a boundary drags
cannot cross (`isolate`), a frame to draw the ghost in that survives a clipping
ancestor, and one vantage point to observe every drag beneath it from —
`onDragStart`/`onDragMove`/`onDragEnd`/`onDrop` cover the subtree, not just the
children you can point at. Managers nest by publishing a path of ids rather than
by stacking providers, so an inner board isolates from an outer one without either
knowing the other exists, and a zone mounted through a portal or on another screen
stays reachable as long as no isolating manager sits between.

**The payload is readable for the whole drag**, which on web it is not by default.
The DOM drag data store is *protected* on every event between `dragstart` and the
drop — `types` still lists the formats, `getData` returns `''`, a privacy rule so a
page cannot read what is merely being dragged across it — and that applies to the
source's own listeners too, `dragend` included. So a zone asking `accepts` what is
coming, or an `onDrop` reading it out, would get nothing under a real mouse drag.
The transfer handed to every callback is therefore a readable mirror, snapshotted
at lift while the store still answers, with writes going through to the browser's
own so a format added mid-drag still crosses to a plain `drop` listener.

**External drags.** `acceptsExternal` lets a zone take a payload the library never
saw start — OS files, another tab — arriving as `drag: null`, `external: true`, and
`files` on the event. Off by default, because a zone that has not asked for files
should not swallow the page's own drop handling.

Two subscription channels keep the cost honest: render-visible state (a drag
starting, a zone edge crossed, a drag ending) goes through `useSyncExternalStore`,
while pointer movement goes to a separate move channel that no component re-renders
for. Travelling inside one zone publishes nothing at all.

Both are pointer-only, on every platform. A manager is the natural home for the
non-pointer path the same outcome owes its users, since it already sees every drop.

`Draggable`, `Dragzone` and `DragManager` now live under a `gestures` category —
`rn-motion-ui/draggable` is unchanged, and the store and its hooks are exported at
`rn-motion-ui/drag-store` and `rn-motion-ui/use-drag-store` for custom transports
or zones. New types: `DragzoneProps` and `DragManagerProps` from their own
subpaths, and — from `rn-motion-ui/drag-types` — `DragzoneHandle`,
`DragzoneRenderState`, `DragzoneDropEvent`, `DragzoneAcceptEvent`,
`DragManagerHandle`, `DragManagerEvent`, `ActiveDrag`, `DragSnapshot`,
`DragEndOutcome`.
