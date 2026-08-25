---
'rn-motion-ui': major
---

feat: replace IconButton/MorphingFAB `variant` with a `floating` toggle, and add the same toggle to every surface

**Breaking changes**

- **`IconButton`** — the `variant` prop (`'neutral' | 'elevated'`) is removed, replaced by two independent props:
  - `elevation` (`0–8`, default `3`) — the surface level, driving the background tint (`bg-surface-N`) and the `shadow-elevated-N` recipe.
  - `floating` (`boolean`, default `false`) — swaps that ladder shadow for the input field's large, diffuse halo (`shadow-floating`).

  The two old variants map onto the new defaults exactly, so the migration is mechanical and nothing changes visually:

  | before | after |
  | --- | --- |
  | `variant="neutral"` (the default) | *(nothing — `elevation` already defaults to `3`)* |
  | `variant="elevated"` | `floating` |

- **`MorphingFAB`** — same change: `variant` is removed in favour of `floating` + `elevation`.

**New `floating` toggle on every other surface**

Every component that already exposed `elevation` (`0–8`) now also takes `floating` (`boolean`, default `false`). It swaps the `shadow-elevated-N` recipe for `shadow-floating` — the same soft, zero-offset halo `Input`'s `floating` variant wears. The two are alternatives rather than layers, since both write `box-shadow`; the background tint still follows `elevation`, so a floating surface keeps its place in the ladder while wearing the softer drop.

Because it defaults to `false`, every existing surface renders exactly as before.

Affected: `Card`, `RadioCard`, `CheckboxCard`, `WheelPicker`, `Dock`, `Drawer`, `BottomSheet`, `Popover`, `FullSheet`, `BloomMenu`, `CloseButton`, `MorphingModal`, `ActionFeedbackModal`, `AdaptiveDropdown`, `AdaptiveModal`, `HoverMenu`, `SwipeableList`, `BouncyAccordion`, and `MorphingSwitcher`.

The shared helpers `elevated()` (`packages/ui/src/lib/elevated.ts`) and `surface()` (`packages/ui/src/lib/surface.ts`) each take a trailing, defaulted `floating` argument to carry the toggle, and `FLOATING_SHADOW_CLASSNAME` is exported so components share one definition of the halo.
