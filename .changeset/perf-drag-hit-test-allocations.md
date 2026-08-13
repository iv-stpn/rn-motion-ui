---
"rn-motion-ui": patch
---

**Drag hit test: fewer per-frame allocations**

The drag hit test runs once per pointer move, so anything it allocates is paid every frame. Three small changes take that cost out of the hot path without touching what it decides:

- **Single-pass drop resolution** — `resolveDropTarget` no longer builds a candidate list and sorts it; it walks the zones once keeping the best by the same tie-break order (priority → depth → area → registration). Same winner, no `hits` array, no `sort`.
- **Cached config objects** — `<Dragzone>` and `<DragManager>` hold their config on a ref and return the cached object from `getConfig`, instead of building a fresh config on every call. The store reads the same values; function identity is unchanged, so registrations still run once.
- **Cached zone list** — the store keeps the zone map as an array, rebuilt only on register/unregister instead of `[...zones.values()]` on every move.

No behaviour change: the hit test resolves the same target, and the existing drag tests confirm it.
