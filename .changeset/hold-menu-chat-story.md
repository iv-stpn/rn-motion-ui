---
'rn-motion-ui': patch
---

fix(ui): HoldMenu — the demo chat is a full 15-message thread, fills the story page and scrolls internally

The demo previously showed two bubbles in a small box; there was no way to
exercise the menu against a real scroll view. The chat is now a full thread
(header, fifteen HoldItem bubbles, pinned action readout) that occupies the
whole story page, with the list bounded by a definite `height: calc(100vh - 3rem)`
so it scrolls internally — hold a bubble near the bottom edge and the panel
travels up with it, scroll mid-thread and the menu clamps to the viewport.

The story wrapper switched from `min-height` (a floor — content taller than it
grew the page) to a definite `height`, and dropped `flex-1` (whose
`flex-basis: 0%` overrides the `height` property for flex items). The
Interactive playground now stretches the same chat below its controls.
