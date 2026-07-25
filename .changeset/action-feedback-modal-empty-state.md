---
"rn-motion-ui": patch
---

ActionFeedbackModal: skip the loading/success text block entirely when no text props are set. Each state block is a flex child of a `gap-4` column, so an empty one still added a stray 16px gap under the morph icon — the minimal variant (icon only) now sits flush.
