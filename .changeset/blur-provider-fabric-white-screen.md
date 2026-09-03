---
'rn-motion-ui': patch
---

fix(BlurProvider): don't wrap the app in the peer's BlurTarget on Fabric

On Android the `BlurProvider` wraps the app root in the optional peer's
`BlurTarget` so the `BlurView` scrims can frost the page. Under Fabric that
peer's `TargetView` redirects every child into an inner view whose
`onLayout`/`requestLayout` are old-arch no-ops, so the children are never
measured/positioned and the whole app collapses to a white screen. `BlurProvider`
now detects the new architecture and skips the target there, degrading Android
scrims to the plain translucent dim — exactly as when the peer is absent.
