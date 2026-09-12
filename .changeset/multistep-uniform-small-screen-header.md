---
'rn-motion-ui': minor
---

feat(MultiStepMenu): uniform small-screen header — back arrow on every step, close ✕ on deeper steps only

The small-screen sheet special-cased the root: no back button, the title sat in the
header row, and the root content rolled/faded while deeper panes slid sideways.
Every step now wears the same chrome:

- the back arrow (an `IconButton`) is always present — it dismisses the sheet on
  the root and steps back on deeper steps;
- the title sits on its own line below the header on every step;
- the close ✕ fades in only once you've stepped past the root;
- content panes slide horizontally on every step instead of the root's roll-up and
  first-layer fade.
