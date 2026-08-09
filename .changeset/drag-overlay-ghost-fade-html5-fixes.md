---
"rn-motion-ui": patch
---

**Drag overlay: ghost fade-out, HTML5 positioning, Safari fixes**

**Ghost settle animation:** When a drag ends, the ghost now fades out over 200ms instead of disappearing instantly. The overlay caches the last non-null drag and preview so the ghost renders until the fade-out completes.

**HTML5 overlay ghost positioning:** Under the HTML5 transport, the overlay ghost now anchors horizontally to the source element's left edge (matching the div the user lifted) while following the cursor vertically — instead of using the pan-transport offset calculation.

**HTML5 drag image hiding:** When a `DragManager` overlay will draw the ghost, the browser's native drag image is replaced with a 1×1 transparent GIF. This prevents a double ghost and stops Safari from snapping the native image back to the lift point when the cursor leaves the window.

**Safari teleport rejection:** Safari fires `drag` events with the grab-point coordinates when the cursor leaves the browser window. These are now detected and rejected (non-zero coordinates that are a teleport back to the lift position), preventing the ghost from snapping back to the source mid-drag.

**`DraggableSession`** now exposes a `overlayHostId` field so the HTML5 transport can decide whether to hide the browser's drag image.
