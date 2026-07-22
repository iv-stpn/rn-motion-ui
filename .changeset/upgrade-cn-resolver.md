---
"rn-motion-ui": minor
---

Upgrade `cn` to a last-wins conflict resolver.

Previously `cn` was additive-only (joined truthy strings). It now performs conflict resolution for all utility groups emitted by this library (layout, sizing, spacing, typography, color, border, etc.) — consumer `className` passed as the last argument always wins over component defaults, matching the behavior of `tailwind-merge` for the groups this library uses with zero added runtime dependencies.
