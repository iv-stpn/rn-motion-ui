---
'rn-motion-ui': major
---

Remove `GlossyButton`

- The `GlossyButton` component is removed, along with its `rn-motion-ui/glossy-button` export and the `glossyContentColor` helper.
- `StatefulButton`'s `chip` prop no longer accepts `'glossy'` — it is `'elevated'` or omitted for the flat button.
