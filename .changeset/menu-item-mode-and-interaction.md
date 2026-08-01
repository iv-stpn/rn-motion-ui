---
"rn-motion-ui": minor
---

`MenuItem`: `mode` prop, hover/press feedback, retuned default scale

**New: `mode`.** The default (non-`iconBackgroundColor`) variant now comes in two
flavours, because the same row serves two jobs: a command-palette list, where
every entry reads as equally available, and a sidebar, where the selected entry
has to win against its neighbours.

| `mode` | Label | Leading icon |
|-----|-----|-----|
| `'menu'` (default) | `foreground`, normal weight — active or not | `foreground`, active or not |
| `'sidebar'` | `font-medium`; `muted-foreground` when inactive | `muted-foreground` when inactive |

```tsx
// Sidebar: the active row is the only one at full contrast
<MenuItem label="General" icon={Settings} mode="sidebar" active={tab === 'general'} onPress={go} />
```

`mode` is ignored when `iconBackgroundColor` is set — that variant keeps its own
treatment (coloured icon square, filled active row, label inverted over the
fill), and `'sidebar'` no longer leaks its medium weight onto that label.
The default is `'menu'`, which is the previous behaviour for active rows, so
existing call sites keep their look except for the scale changes below.

New type: `MenuItemMode`.

**Hover and press feedback.** The row now fills on hover (`surface-hover`) and
on press (`surface-selected`). Both are suppressed while `active` or `disabled`,
so the active highlight is never double-painted and a disabled row stays inert.

Driving those fills means the row owns `onHoverIn`, `onHoverOut`, `onPressIn` and
`onPressOut`, so each one forwards to a caller's handler of the same name after
setting its own state. Passing any of the four still works exactly as before —
`CommandPalette` relies on this, using `onPressIn` to move its active row.

**Retuned default scale.** The `md` and `lg` rows were loose next to the
palettes and sidebars they're used in — `md` lost vertical padding and a label
step, `lg` gained horizontal padding and a larger icon:

| Size | Changed |
|-----|-----|
| `sm` | label pinned to 12px (was `text-xs`, the same size) |
| `md` | `py-2` → `py-1.5`; label 16px → 14px; icon spacer `h-4 w-4` → `h-5 w-5` |
| `lg` | `px-3` → `px-4`; icon 22 → 24; icon spacer `h-4.5 w-4.5` → `h-6 w-6`; label pinned to 18px |

Label sizes are now explicit pixel values rather than Tailwind's `text-*` steps.
The `iconPlaceholder` spacer sizes are matched to the rendered icon at each size,
so a row without an icon now aligns with one that has it.
