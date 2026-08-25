---
'rn-motion-ui': minor
---

feat(RadioCard, CheckboxCard): add an inline layout

Both cards take a new `layout` prop — `'stacked' | 'inline'`, on the group and
overridable per card. `"stacked"` is the existing arrangement and the default,
so nothing changes unless you opt in: the ring/box leads a row of its own above
the text, with the badge riding that row's far end.

`"inline"` moves the control to the card's trailing edge, centred against the
text beside it, and the badge follows the title it qualifies instead. That's the
settings-list shape — text on the left, control on the right, one row per option.

It's a separate axis from the group's `orientation`, which lays the *cards* out
rather than each card's contents, and the two compose freely. Under
`variant="card"` there's no ring to place, so `layout` only decides where the
badge sits.

The text column moves into a private `RadioCardBody` / `CheckboxCardBody` so
each card component stays under the complexity cap, and `RadioCardRing` gains
`shrink-0` so a long title can't squeeze the ring now that they can share a row
— matching `Radio` and `Checkbox`, whose controls were already shrink-proof.
Both stories gain a Layout control in the playground and an inline demo.
