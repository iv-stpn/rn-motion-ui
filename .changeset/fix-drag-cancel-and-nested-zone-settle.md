---
"rn-motion-ui": patch
---

**Drag store: honour browser-cancelled drags and settle nested dropzone mounts**

- **Cancelled drags stay put** — an HTML5 `dragend` reporting `dropEffect: 'none'` (Escape, or a re-render tearing the source out from under the lift) no longer credits a drop to a zone that merely sits under the release point. A zone of ours would have claimed the drag in its own `dragover`, so `'none'` now means "no in-library drop happened" and the store resolves it as cancelled.
- **Nested zone mounts resolve once** — when several overlapping zones register mid-drag (an expanded folder tree's overlay dropzones mount together), their re-resolution is coalesced into a single all-zone refresh, and `moveDrag` holds the target while that resolution settles. A deep file's drag no longer flashes the outermost zone before its own parent takes over; the tie-break decides the deepest zone in one step.
