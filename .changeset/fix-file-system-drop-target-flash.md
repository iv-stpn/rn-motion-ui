---
"rn-motion-ui": patch
---

**FileSystem: stable folder-drag drop targets**

- **Deferred overlay mount** — the overlay dropzones (and the folder-row wrappers they suppress) now mount one tick after the drag starts, so mounting over the source row can't tear Chromium's drag down inside its own `dragstart`.
- **Portal overlays** — an expanded folder's overlay now registers every in-library file-system drag, even a release that would move nothing, so the ancestor's larger overlay never "shows through" and moves a file up a level on a no-op drop.
- **Gated body outline** — the whole-area fallback ring waits ~100ms for in-library drags, so it no longer flashes under the pointer while an expanded folder's overlay mounts and measures.
- **Correct selection clearing** — a lift now clears prior selection only when it doesn't carry the selected set (read from the transfer), instead of trusting `drag.source.id`, which is never an entry path.
