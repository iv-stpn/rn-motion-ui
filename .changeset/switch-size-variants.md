---
"rn-motion-ui": minor
---

**Switch**: `sm`, `md`, and `lg` size variants.

The track, thumb, travel distance and label text scale now all respond to a single
`size` prop. `'md'` is the default, so existing usage is unchanged.

```tsx
<Switch isSelected={on} onSelectedChange={setOn} size="sm" label="Compact" />
<Switch isSelected={on} onSelectedChange={setOn} size="md" label="Default" />
<Switch isSelected={on} onSelectedChange={setOn} size="lg" label="Large" />
```

| size | track | thumb | travel |
| ---- | ----- | ----- | ------ |
| `sm` | 16 × 32 px | 12 × 20 px | 8 px |
| `md` | 20 × 44 px | 16 × 26 px | 14 px |
| `lg` | 28 × 56 px | 24 × 36 px | 16 px |

The thumb's height is not a per-size number: it insets 2px from the top and the
bottom of whatever track holds it, so the two always agree and a retuned track
carries the thumb with it.

Size is threaded through context, so `Switch.Thumb` and custom children pick it up
automatically — no extra prop is needed on sub-components.
