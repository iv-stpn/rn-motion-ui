---
"rn-motion-ui": minor
---

Simplify status token model to vivid filled pairs; rename `destructive` → `danger`; remove `Card` variant prop.

**Breaking — status token model** (`rn-motion-ui/tokens.css`, `use-theme-color`):

- The soft-plate triad system (`*-border` partners) is replaced by vivid filled pairs: `danger` / `success` / `warning` / `info` are now saturated filled backgrounds; `*-foreground` is white in both themes for consistent legibility on the fill. The `*-border` tokens (`danger-border`, `success-border`, `warning-border`, `info-border`) are removed entirely.
- `--color-destructive` / `--color-destructive-foreground` are removed. The unified `danger` pair covers both the former soft plate and the vivid action use-case. Any code referencing `destructive` (CSS variable, Tailwind class `bg-destructive` / `text-destructive`, or `ThemeToken`) must migrate to `danger`.
- `ThemeToken` (exported from `use-theme-color`) drops `destructive`, `destructive-foreground`, `success-border`, `warning-border`, `info-border`, `danger-border`.

**Breaking — `Button` variant**:

- The `'destructive'` variant is renamed `'danger'`. Update any `<Button variant="destructive" />` to `variant="danger"`.

**Breaking — `Card` `variant` prop removed**:

- `Card` no longer accepts a `variant` prop (`'border' | 'elevated' | 'filled'`). All cards now render as elevation-based surfaces: background and shadow derive from the `elevation` prop (default `3`). Replace `variant="filled"` with a `className` override, and drop `variant="border"` / `variant="elevated"` (behaviour is equivalent to the former `elevated` with `elevation={3}`).

**Breaking — `AnimatedBadge` style**:

- Badge containers are now borderless vivid fills (matching the new status token model). The animated border was removed; the `X` error icon is replaced with `AlertCircle`. Visual appearance changes in all status variants.

**New — `StarRating` customisation props**:

- `activeStarColor?: string` — color of filled stars and the sparkle burst. Defaults to a fixed gold (`#edde51`) that reads as a star across every theme.
- `inactiveStarColor?: string` — color of empty stars. Defaults to the theme `border` token.
- `round?: boolean` — round stroke caps and joins (default `true`). Set `false` for sharp star points.

**New — `AdaptiveDropdown` trigger function receives `toggle`**:

- The render-prop form of `trigger` now receives `{ open, toggle }` instead of `{ open }` only. Use `toggle` when the trigger is itself pressable (e.g. a `Button`) so the inner pressable can wire `onPress` to `toggle` directly, bypassing the outer wrapper's own toggle.
