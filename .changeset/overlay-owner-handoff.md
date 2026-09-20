---
'rn-motion-ui': patch
---

Keep the single overlay `Modal` alive when the bottom overlay closes while another is still open.

N open overlays collapse into one native `Modal`: the bottom (first-registered) layer owns it and draws every layer in registration order, and later layers register as guests that render nothing at their call site. Which layer owned that `Modal` was decided once, when the layer registered — and a layer left the stack as soon as its own content finished exiting. So an overlay closing under another took the `Modal`, and everything drawn inside it, down with it: a settings sheet that raised a confirm dialog in the same tick lost the dialog the moment the sheet's exit animation ended, hanging the `confirmDialog()` promise its caller was awaiting.

Ownership is now read from the live stack on every render instead of latched at registration, and a bottom layer whose own content has exited stays registered as a **host** drawing only the layers above it, for as long as any are open. The `Modal` mounts when the first overlay opens and unmounts when the last one closes, never remounting in between.

This also fixes the worse failure that followed it: a guest left with no owner kept the stack non-empty forever, so every later overlay registered above a `Modal` that nothing owned and rendered nowhere — the session stayed overlay-dead until a reload. With ownership derived from the stack, a layer torn down outright (a parent unmounting mid-open) promotes the layer above it instead of stranding it.
