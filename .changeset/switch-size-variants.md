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
| `md` | 24 × 48 px | 20 × 28 px | 16 px |
| `lg` | 32 × 64 px | 28 × 38 px | 22 px |

Size is threaded through context, so `Switch.Thumb` and custom children pick it up
automatically — no extra prop is needed on sub-components.
