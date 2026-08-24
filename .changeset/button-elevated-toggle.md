---
'rn-motion-ui': minor
---

feat(Button): add `elevated` + `elevation` props

`Button` can now be floated or flattened independently of its `variant`:

- **`elevated`** (`boolean`) — whether the button casts the `shadow-elevated-N`
  recipe (drop + dark-mode rim). It is deliberately **tri-state**: leave it
  unset and the button keeps its variant's own resting float, so `danger`,
  `success`, `warning`, `info` and `special` float while `neutral`, `inverse`,
  `ghost`, `outline`, `outlineDanger` and `ghostDanger` sit flat. Set it
  explicitly to override — `elevated` raises a flat variant, `elevated={false}`
  flattens a filled one.
- **`elevation`** (`0–8`, default `3`) — the shadow level used when the button
  is elevated. Unlike the surface components this drives the shadow *only*: a
  Button's background comes from its `variant`, not the surface ladder, so
  raising `elevation` floats the button without recolouring it.

This is additive. The float was previously hard-coded into the variant table as
`shadow-elevated-3` on the five filled variants; it now comes from
`elevatedShadow(elevation)` gated on the resolved `elevated`. With both props
unset every variant renders exactly the classes it did before.

`ElevatedButton` is unchanged and intentionally has no `elevated` prop: its
glossy drop and coloured 1px ring are computed per-variant from the fill colour
rather than the `shadow-elevated-N` ladder, and they are the component's whole
identity rather than an option.
