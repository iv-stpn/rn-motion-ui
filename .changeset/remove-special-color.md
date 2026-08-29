---
'rn-motion-ui': patch
---

feat(theme): remove the `special` color token and its variants

Drops the non-semantic `special` accent: the `--color-special` /
`--color-special-foreground` tokens (and their native OKLCH entries in
`useThemeColor`) are gone, along with the `special` variant on `Button`,
`ElevatedButton`, `StatefulButton`, `Checkbox`, `Switch` and `ThemedIcon`.
Pick a semantic status fill (`info`, `success`, `warning`, `danger`) instead.
