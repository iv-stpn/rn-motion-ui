---
"rn-motion-ui": patch
---

**MorphingModal bottom-sheet sizes to content width; FeedbackWidget and Checkbox layout fixes**

- **MorphingModal** `bottom-sheet` placement now measures content width and animates it alongside height, so the card sizes to its content instead of stretching full-width. The positioning wrapper changed from `items-stretch` to `items-center`.
- **FeedbackWidget** trigger button centres the icon in a `flex-1` wrapper, fixing vertical alignment when the button is stretched by its parent.
- **Checkbox** uses `-inset-px` for the fill background so it doesn't peek past the border-radius on subpixel-snapped edges.
- **ButtonSpinner** (exported from `button-internals`) now accepts a `size` prop for proportional radius and stroke width.
