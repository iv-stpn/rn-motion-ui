---
'rn-motion-ui': patch
---

fix(Surface): auto-degrade frosted panes inside their BlurTarget on Android

A `BlurView` that renders inside the very `BlurTarget` it references cycles the
Android RenderNode graph — the render thread recurses in
`RenderNode::prepareTreeImpl` until the stack overflows (`Fatal signal 11`).
Because `BlurProvider` wraps the app in its `BlurTarget`, every in-page frosted
`Surface` was a descendant of its own blur source, so frosted/rim surfaces
crashed on Android (web and iOS blur behind themselves and were unaffected).

- The provider now marks the `BlurTarget`'s subtree via context
  (`insideBlurTarget`), and a frosted pane that detects it renders inside the
  target it would blur degrades to the translucent `glass` tint fill instead of
  mounting a `BlurView`. `inline` remains as the manual escape hatch for hosts
  the context can't see.
- The `BlurTarget` now fills the region it wraps (`flex: 1`) — the peer's
  `TargetView` has no default size, so wrapped content collapsed to zero height
  (a blank app) once the peer was natively linked.
