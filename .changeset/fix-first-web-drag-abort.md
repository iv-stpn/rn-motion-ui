---
"rn-motion-ui": patch
---

**Draggable & Dragzone: web drags land on first load and credit the right effect**

- **Pre-loaded drag image** — the empty `<img>` that hides the browser's native ghost under a `<DragManager>` overlay is now created and decoded once at module load, not freshly inside each `dragstart`. The engine snapshots the drag image only after the handler returns, so an image that has not finished decoding yet has no dimensions and the whole drag aborts — which is why the first drag on a fresh page load died instantly and every later one, with the decode cached, worked.
- **Zones claim their own effect** — `dragover` now claims the zone's configured `dropEffect` rather than defaulting to `'copy'`. A `'copy'` claim against a source whose `effectAllowed` is `'move'` is silently ignored by the browser, so `dragend` read `'none'` and a legitimate drop was reported as cancelled. Claiming the matching effect keeps the drop credited.
