---
'rn-motion-ui': patch
---

fix(AnimatedBadge): tighten the `md` badge gap and height

The medium badge drops its icon–label gap from `gap-1.5` to `gap-1` and its
height from `h-8` to `h-7`, trimming the vertical padding for a more compact
plate without changing the `sm` size.
