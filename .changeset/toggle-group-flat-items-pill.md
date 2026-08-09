---
"rn-motion-ui": minor
---

**ToggleGroup: replace Button children with `items` prop; add `pill` variant; fix bordered outer border**

BREAKING: `ToggleGroup` no longer accepts Button children. Replace `children` with the new `items` prop (`{ value: string; label: ReactNode }[]`). The `selectedVariant`, `unselectedVariant`, and `pressMode` props are removed. The `size` prop is now `'sm' | 'md' | 'lg'` (drops `'icon'`).

BREAKING: `Button` and `ElevatedButton` no longer accept a `value` prop. This was only used by the old ToggleGroup pattern and is now removed from `BaseButtonProps`.

New `pill` variant: a `bg-muted rounded-full` container with a spring-animated sliding indicator (`bg-surface-3` / `dark:bg-black`) that glides behind the selected item's text. Respects `useReducedMotion()`.

Fixed `bordered` variant: now renders a visible outer border (`border border-border rounded-interactive`) in addition to the existing inner divider borders.

Items are now flat `Pressable` + `Text` surfaces (no longer Button components), with uniform `px-3` horizontal padding.
