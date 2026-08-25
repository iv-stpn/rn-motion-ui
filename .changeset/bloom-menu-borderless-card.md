---
'rn-motion-ui': patch
---

fix(BloomMenu): drop the morph card's outline and full-bleed the trigger face

The shared-layout card that springs between the trigger and the panel carried a
`border-border` outline, which the other menu surfaces had already dropped —
they read against the page through `surface()`'s fill and shadow alone. The
outline is gone, so BloomMenu matches them.

The trigger face was inset by 1px on every side to sit inside that outline, and
rounded at a hardcoded `15` to match the card's radius minus the inset. With no
edge left to inset from, it now covers the card corner to corner and takes the
shared `MENU_RADIUS` constant instead of the literal.
