---
'rn-motion-ui': minor
---

Default `StatefulButton`'s `variant` to `primary`.

The button ran its machine on a `neutral` plate unless the caller named a variant, so the one component whose whole job is driving the primary action of a screen — a submit, an upload, a confirm — rendered as the quiet plate by default. `primary` is now the default: a `StatefulButton` with no `variant` is the filled primary plate, and the machine's success/error states crossfade against it exactly as they did against `neutral`.

`Button` keeps `neutral` as its default, so this is a deliberate divergence rather than a family-wide change: a bare `Button` is still the neutral plate, and a bare `StatefulButton` is now the primary one.

**Consumer-visible change:** any existing `StatefulButton` that omits `variant` renders the primary fill instead of the neutral one. Pass `variant="neutral"` to keep the previous appearance.
