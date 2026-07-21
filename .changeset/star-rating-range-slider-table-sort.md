---
"rn-motion-ui": minor
---

feat(star-rating): new animated StarRating component; fix(range-slider): no spring on mount, hide thumb until layout; perf(table): skip sort allocation when already sorted

**StarRating** (new component — `@rn-motion-ui/ui/star-rating`)

- Animated star-rating input: tapping a star commits the rating with a squash-and-stretch pop and an amber sparkle burst; tapping the committed star clears it (`allowClear`, default `true`).
- Works controlled (`value` prop) or uncontrolled (`defaultValue`).
- Supports fractional read-only display (e.g. 4.3 stars) via `readOnly`.
- Optional rolling value label (`showValue`) animates up/down as the value changes.
- Three sizes: `sm`, `md` (default), `lg`.
- Full accessibility: `radiogroup` / `radio` ARIA roles, `increment` / `decrement` actions.
- Honours `prefers-reduced-motion` — all animations collapse to instant.
- Storybook story included.

**RangeSlider**

- `smooth` shared value is now initialised to the current ratio so there is no spring animation on first render.
- Thumb is hidden (`opacity: 0`) until `onLayout` fires, preventing a flash at `x=0` on mount.
- Replaced `useDerivedValue` with `useSharedValue` + `useEffect` to keep the smooth value in sync with externally-controlled `ratio` changes.

**Table utilities**

- `sortRows` checks whether `rows` is already in sorted order before allocating a new array; returns the same reference when no sort is needed, avoiding a `FlatList` reconciliation pass on every render.
- Extracted `compareValues` helper to eliminate duplicated null / number / string comparison logic.
