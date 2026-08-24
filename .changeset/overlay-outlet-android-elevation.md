---
'rn-motion-ui': patch
---

fix(Overlay): keep the portal outlet above BottomSheet on Android

The overlay outlet layer now carries `elevation: 25` on Android. `BottomSheet`'s
panel sets `elevation: 24` — the only hard elevation in the overlay set — which
on Android wins over sibling order, so content portaled through the outlet (a
button, a menu) could render *underneath* the sheet. Clearing the sheet's
elevation puts injected content back on top. No-op on iOS and web, where
`zIndex` and document order already put the last sibling in front.
