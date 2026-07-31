---
"rn-motion-ui": minor
---

Add `MenuItem` — a shared menu-row primitive, now exported as `rn-motion-ui/menu-item`

`CommandPalette` and `MultiStepMenu` each carried their own near-identical menu-row markup (leading icon, label, active highlight, trailing slot). That row is now a single component with two visual modes selected by `iconBackgroundColor`:

- **Default** — CommandPalette style: animated `bg-surface-selected` overlay, 16 px themed icon, `py-2` padding, `text-sm` label.
- **iOS-style** (`iconBackgroundColor` set) — Settings/MultiStepMenu style: coloured rounded-square icon, `bg-primary/75` active highlight, `h-11` row, `text-base` label.

```tsx
import { MenuItem } from 'rn-motion-ui/menu-item'

<MenuItem icon={Bell} label="Notifications" active={isActive} onPress={select} />
```

`MultiStepMenu`'s `MenuRow` and `CommandPalette`'s internal `CommandRow` are now thin wrappers over it — no public API change to either, beyond `MenuRowProps['icon']` being typed as the exported `MenuItemIcon` (structurally identical to the previous local `IconRenderer`) and `CommandIconProps` becoming an alias of the shared `IconProps` (widened with the optional `strokeWidth`, `style` and `accessibilityLabel` fields; existing icon renderers stay assignable).

`BottomSheet`'s sheet container moves onto `cn()` + the `SURFACE_CLASSNAME` ladder. Two visual consequences: it now carries `shadow-elevated-3` alongside `bg-surface-3`, and its non-full-sheet top radius changes from `rounded-t-2xl` to `rounded-t-lg`.

Also folded template-literal class concatenation into `cn()` in `ActionFeedbackModal`, dropped the now-unneeded `useSortedClasses` biome-ignore comments, and rewrote the `AdaptiveDropdown` / `HoverMenu` stories to use the shared row instead of local one-off copies.
