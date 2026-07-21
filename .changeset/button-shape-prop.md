---
"rn-motion-ui": minor
---

feat(button): add `shape`, `noDisabledOpacity`, `backdropColor`, and `contentStyle` props

- `shape` controls the border radius: `'rounded'` (default, `rounded-xl`) or `'pill'` (`rounded-full`). Previously all sizes hard-coded `rounded-full`.
- `noDisabledOpacity` skips the 0.5 opacity when `disabled`, for cases where a button is disabled for interaction reasons but should remain visually prominent (e.g. success/error hold in StatefulButton).
- `backdropColor` animates an absolutely-positioned colour overlay in/out by opacity without touching the variant background — used by StatefulButton for its success/error state fill.
- `contentStyle` applies extra inline style to the Pressable container for layout overrides that cva class strings control.
