---
"rn-motion-ui": minor
---

**FileSystem: mobile grid + list views with hold-drag multi-select**

- **Two new mobile views** — `mobile-grid` (a two-column thumbnail grid) and `mobile-list` (two-line rows). Each entry carries a visible kebab that opens its context menu, and once anything is selected every kebab yields to a checkbox.
- **Hold-drag scrub** — press-and-hold a checkbox and drag down/up to select or deselect the contiguous run under the finger. Photos-style: the entry the drag starts on fixes whether the run is added or removed. The gesture is touch-only and rides the same arm-then-drag `Pan` transport as the hold/drag primitives.
- **Background plates** — grid thumbnails sit on a `bg-surface-2` plate so they read as distinct tiles instead of floating on the page.
