---
'rn-motion-ui': patch
---

fix(ChoiceGroup): unclip vertical labels

Vertical groups no longer clip their labels: items drop the fixed
`h-interactive-*` height and grow from `py-3` instead, so each label keeps its
full line box rather than being squeezed into the fixed height minus the
padding. Horizontal items are unchanged.
