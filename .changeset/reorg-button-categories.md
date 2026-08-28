---
'rn-motion-ui': patch
---

reorganise component source into `buttons` and `navigation` categories

`Button`, `ButtonGroup`, `ButtonSwap`, `ElevatedButton`, `StatefulButton`,
`IconButton` and `CloseButton` move from `components/form/*` and
`components/menus/CloseButton` into `components/buttons/*`, and `OverflowActions`
moves from `components/menus/*` into `components/navigation/*`. The public import
subpaths (`.button`, `.icon-button`, `.overflow-actions`, …) are unchanged, as are
the `source`/`types`/`default` targets now pointing at the new locations — this is a
source-tree tidy with no consumer-facing API change.
