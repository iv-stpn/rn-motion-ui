---
"rn-motion-ui": patch
---

**FileSystem: icons grid reflows in unison**

The icons grid animated only the added or removed tile — an entering tile grew its width, an exiting one collapsed — while every other tile jumped when the grid re-chunked. Moving an item into a folder, deleting one, or dropping one in from outside now reflows the whole grid as one motion:

- **Shared layout transition** — every tile carries a Reanimated `layout` transition, so the remaining tiles slide to their new slots together when a sibling is added or removed.
- **Fade + scale enter/exit** — added tiles fade/zoom in and removed ones fade/zoom out, replacing the horizontal width grow/shrink.
- **Flattened grid** — the virtualized row `FlatList` became a flat flex-wrap layout so a tile can animate across rows (the trade-off: the icons grid no longer windows).
- **Instant wholesale swaps** — initial mount, folder navigation, and filter toggles still swap instantly with no mass enter/exit.
