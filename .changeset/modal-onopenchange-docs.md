---
'rn-motion-ui': patch
---

Document that the modal family's `onOpenChange` only ever reports the dismiss direction.

`MorphingModal`, `AdaptiveModal`, `BottomSheet`, `FullSheet` and `ActionFeedbackModal` all accept `onOpenChange`, and all five call it with `false` and never with `true`. That is by design rather than an oversight — each takes `open` as a prop and has no setter for it, so the component cannot open itself and there is no open transition to report. Anchoring the "open" signal is `onShow`'s job, which fires once the surface has fully presented and it is safe to focus content inside it.

`MorphingModal`'s doc comment said the opposite, describing a callback "fired when the modal opens or closes" and leaving a reader to expect a `true` that never arrives; the other four said nothing at all. All five now state which direction fires and, for `ActionFeedbackModal`, which affordances raise it (backdrop, dismiss button, success auto-close).

No behaviour change — this is the JSDoc catching up to what the components already do.
