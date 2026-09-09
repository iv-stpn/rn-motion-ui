---
'rn-motion-ui': patch
---

fix(Overlay): collapse nested overlays into a single native Modal

Two overlays opened at once used to each mount their own `<Modal>`. On iOS
(Fabric, RN 0.86.3) the second `presentViewController:` targets the app's base
VC — already presenting the first modal — so UIKit silently drops it: a confirm
dialog raised from a settings menu never appeared.

`OverlayShell` now collapses N native modals into **one** Modal hosting N
JS-stacked layers:

- The bottom (first-registered) layer owns the Modal and renders every layer in
  registration order; later layers register as guests and render nothing at their
  call site.
- Each layer keeps its own `AnimatePresence` + `MotiView` exit, its own dialog
  `role`/`aria-label`/`accessibilityViewIsModal`, and its own focus trap.
- `onShow` is emitted per-layer from that layer's enter transition (iOS only).
- The toast portal still re-targets onto the topmost layer's outlet.

No public API change: `open`/`onOpenChange`/`testID` and the
`OverlayShell`/`OverlayPortal` exports are unchanged.
