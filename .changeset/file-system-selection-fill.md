---
"rn-motion-ui": patch
---

`FileSystem`: the selected row now reads as a selection rather than as the primary fill

Selection in the list, icons and columns views was painted with `primary` — the monochrome token consumers are meant to override with their own brand color. So a selected row went near-black in light mode and near-white in dark, and any consumer who retinted `primary` got their brand color as the selection highlight whether or not that was the intent.

It is `info` now — the vivid blue that already reads as "this one is picked" in a file browser, on both schemes, and is not the token a consumer is invited to repaint. The label, the row's metadata columns, and the expand chevron sit on that fill as `white` rather than `primary-foreground`, which on a vivid blue is what legibility actually wants.

Nothing to change on your side unless you were relying on `primary` to tint file-system selection; if you were, that hook is gone on purpose.
