---
'rn-motion-ui': major
---

feat(ButtonSwap): rename `ActionSwap` and give it the full `Button` styling surface

**Breaking change**

`ActionSwap` is now `ButtonSwap`, and it is a member of the button family rather than a display component:

| before | after |
| --- | --- |
| `rn-motion-ui/action-swap` | `rn-motion-ui/button-swap` |
| `ActionSwapButton` | `ButtonSwap` |
| `ActionSwapText` / `ActionSwapIcon` | `ButtonSwapText` / `ButtonSwapIcon` |
| `ActionSwapItem` / `ActionSwapAnimation` | `ButtonSwapItem` / `ButtonSwapAnimation` |
| `ActionSwapButtonVariant` | `ButtonVariant` (Button's own) |
| `ActionSwapButtonSize` / `ActionSwapButtonShape` | `ButtonSize` / `ButtonShape` |

Its four-variant table (`primary`, `secondary`, `outline`, `ghost`) is gone. `ButtonSwap` now paints from the same colour table `Button` does, so map `primary` → `inverse`, `secondary` → `neutral` (the new default), and keep `outline`/`ghost`; the eight remaining variants (`danger`, `success`, `warning`, `info`, `special`, `outlineDanger`, `ghostDanger`) are new to it.

On top of the variant table it gains the rest of Button's styling surface: `elevation` (`0–8`), `floating`, `ripple`, `pressMode`, `pressTransition`, `noDisabledOpacity`, `backdropColor`, `fitWidth`, `className`, `contentClassName`, `labelClassName` and `onPress` (fired on every press, alongside the `cycle` advance). `pressScale` now defaults to `0.93`, matching `Button`, rather than `0.97`; the press spring is `MOTION_SNAPPY` for the same reason. The default `testID` is `button-swap` (was `action-swap-button`).

The colour tables themselves moved to an internal `button-variants` module that `Button` and `ButtonSwap` both read, so the two can no longer drift. The `label` cva is no longer re-exported from `rn-motion-ui/button`.

The story moves to `Form/ButtonSwap` and gains Elevation/Floating/Ripple controls, an elevation ladder, a styling showcase, and a test pinning that `labelClassName` reaches both copies of the swapping label.
