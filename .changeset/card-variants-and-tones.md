---
'rn-motion-ui': patch
---

feat(CheckboxCard, RadioCard): tone accents and a border-only card variant

`RadioCard` and `CheckboxCard` gain a `tone` prop (`neutral` | `info`) for the
selection accent, defaulting to the primary token instead of the hardcoded blue.
`CheckboxCard` gains a `variant` prop (`checkbox` | `card`): `card` hides the
box and mark so the animated border and background tint alone signal selection,
matching `RadioCard`'s existing variant. In horizontal groups the `card` variant
now drops the badge below the title rather than leaving an empty indicator row.
The checkbox box is slightly less rounded and the radio dot slightly larger.
