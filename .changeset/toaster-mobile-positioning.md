---
'rn-motion-ui': patch
---

Fix `Toaster` positioning on mobile.

Toasts now stack with an 8px gap instead of touching, and the native viewport
renders through a `Portal` so toasts anchor to the screen edges and paint above
page content regardless of where `<Toaster />` is mounted — instead of hugging
the nearest container and slipping under their triggers. When no `PortalProvider`
is mounted the viewport falls back to in-place rendering, so apps that mount
`<Toaster />` at the root keep working unchanged.

Add `smallScreenPosition` / `largeScreenPosition` (plus a `wideBreakpoint`
cutoff, default `'sm'`) so a `<Toaster />` can use a different edge on phones
versus tablets/desktop.
