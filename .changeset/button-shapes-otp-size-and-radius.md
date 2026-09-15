---
'rn-motion-ui': patch
---

Refine the square/circle shapes, add OTP slot sizes, bump radius tokens

**`square` is now rounded.** `Button` and `IconButton` squares no longer render
sharp (`rounded-none`); they take `rounded-interactive` (8px) and force a 1:1
box — the label box drops its horizontal padding and pins `w-interactive-*` to
the ramp height, so a long label clips to the square instead of stretching it
into a rectangle. `circle` gets the same forced 1:1 box. `buttonRadius('square')`
and `buttonRadiusClass('square')` now resolve to the interactive radius (were 0
and `rounded-none`).

**`danger` icon colour.** The `danger` variant's leading icon now reads
`danger-foreground` instead of `primary-foreground`, so the icon matches the
label on the red plate.

**`OTPInput` size.** A new `size` prop (`xs | sm | md | lg`, default `lg`) joins
the same `--spacing-interactive-*` ramp the button family reads; the slots, the
digit glyph and the blinking caret all scale with it.

**Radius tokens.** `--radius-card` 16 → 24, `--radius-menu` 12 → 16 and
`--radius-modal` 16 → 32, with `CARD_RADIUS` / `MENU_RADIUS` / `MODAL_RADIUS`
in `radius.ts` updated to match.

The shared storybook trigger now defaults to the `rounded` shape instead of
`pill` (`__stories__/**` is excluded from the published package).
