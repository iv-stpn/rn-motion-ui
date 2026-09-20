---
'rn-motion-ui': minor
---

Add a `shape` prop to `AnimatedBadge` — `pill` (the default, a full capsule) or `rounded` (a tight 6px corner).

The badge previously rendered only as a full capsule. The new `shape="rounded"` swaps the corner to `rounded-md` and trims the horizontal padding to a new `--spacing-interactive-pad-*-tight` token ramp (4px / 6px), so the badge can sit alongside other rounded interactive surfaces instead of always reading as a pill. The loading pulse's corner follows the shape, so its halo matches the plate rather than a hardcoded capsule.
