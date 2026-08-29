---
'rn-motion-ui': patch
---

fix(MenuItem): tighten base-variant padding when the leading icon slot is occupied

The base variant used its `px` to indent a bare text row; when a leading icon
(or its same-size placeholder) occupies the slot, that icon already supplies the
indent, so the extra padding over-indented the label. The base row now uses a
tighter horizontal padding whenever the leading slot is filled.
