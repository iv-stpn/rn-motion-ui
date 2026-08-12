---
"rn-motion-ui": minor
---

**FileSystem: tile animations, spring-loaded folders, resilient lazy loading**

- **Icons view**: grid tiles now animate their width on enter/exit (mirroring the list view's row animation) instead of popping in and out. The shared row-animation hook gains a `shouldAnimate` flag — suppressed while a filter is active — and a timeout fallback that drops stale exiting entries when the animation callback never fires (e.g. tests without Reanimated's worklet runtime).
- **Spring-load**: hovering a drag over a collapsed folder expands it after a short delay and lazy-loads its children, so nested targets are reachable without releasing the pointer.
- **Overlay dropzones**: an expanded folder renders a full-span drop zone overlay during a drag, and the origin folder paints its outline. `refreshDragzones` re-resolves the target after a remeasure, so a stationary cursor tracks rows shifted by an expansion.
- **Folder load errors**: a folder whose `loadChildren` rejects or times out (30s) is tracked in `errorFolders` and can be retried, instead of being blocked forever after a single failure.
- **Empty folders preserved**: a folder that loses its last child (every item dragged out) no longer vanishes from the tree — inferred folders survive an index rebuild.
- **Stale selection cleared on lift**: starting a drag from an unselected item no longer carries previously selected entries into the group.
