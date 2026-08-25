---
'rn-motion-ui': minor
---

feat(Button): add a `floating` prop

`Button` now takes `floating` (`boolean`, default `false`), which swaps whatever
shadow its `variant` carries for the input field's large, diffuse halo
(`shadow-floating`) — the recipe `Input`'s `floating` variant wears. It replaces
rather than layers, since both write `box-shadow`: a floating `danger` trades
its `shadow-elevated-3` for the halo, and a floating `ghost` gains one where it
had none.

This is purely additive — the variant colour table is untouched, so with
`floating` unset every variant renders exactly the classes it did before.

`ElevatedButton` intentionally has no `floating` prop: its glossy drop and
coloured 1px ring are computed per-variant from the fill colour rather than
coming from a shadow token, and they are the component's whole identity rather
than an option.
