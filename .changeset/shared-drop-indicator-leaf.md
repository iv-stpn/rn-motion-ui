---
'rn-motion-ui': patch
---

perf(FileSystem): one shared drop indicator leaf instead of a per-row outline, and a parsed-once drag payload

Dragging across a large folder used to re-render rows on every zone crossing:

- Every folder row, tile and drag-only overlay painted its own `border-info`
  outline from a render-prop `isOver`, so each crossing mounted one indicator
  and unmounted another inside the row it had just left — and the views that
  built their row body inside that function re-rendered the whole row subtree
  with it.
- Every zone's `accepts` re-`JSON.parse`d the drag payload on every pointer
  move, once per zone, so a drag over a hundred rows parsed the same string a
  hundred times a frame.

The drop indicator is now one absolutely-positioned Animated leaf in the drag
scope, painted at the over zone's measured rect (the same rect the store's hit
test resolves the winner from). It re-renders only on drag start/end and zone
crossings, and its geometry is driven by Animated values, so gliding between
targets costs no render at all. Rows and tiles keep their dropzones (accepts,
drop, hover-to-expand) but no longer paint an indicator, and their children are
plain elements, so a crossing never re-renders the row body. The payload reader
is cached per transfer, so each drag parses exactly once.

Background fallbacks (the file area's own zone, column panes) keep their own
drop surfaces — they carry external-drop and delay handling a shared outline
cannot express. The icons and columns views keep their label-chip / row-fill
drop language; the shared outline is what replaces the per-row `border-info`
outlines in the list, mobile list, mobile grid and the expanded-folder overlays.
