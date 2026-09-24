---
'rn-motion-ui': patch
---

Refined the glass and floating-control depth, and the dock's labelled silhouette:

- `Surface` glass now layers a faint full-perimeter keyline beneath its directional glint, so the edge stays legible even at the gradient's dimmest points, and adds a gentle `saturate` boost to its backdrop blur (with the `-webkit-` fallback for Safari).
- Floating controls (`Input`'s `floating` variant) now wear a tighter two-stage shadow — a crisp contact shadow over a lower, wider plume — instead of the old zero-offset halo.
- `MorphingDockSwitch` labelled destinations now widen into horizontal capsules, separated from the disclosure caret by a small gap, so the caret reads as part of the dock rather than a separate destination.
