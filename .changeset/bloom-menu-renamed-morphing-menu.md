---
'rn-motion-ui': major
---

feat: rename `BloomMenu` to `MorphingMenu`, and give it `overlay` + `closeOnOutsidePress`

**Breaking change**

`BloomMenu` is now `MorphingMenu`, and it joins the other menus on the shared
overlay/outside-press surface:

| before | after |
| --- | --- |
| `rn-motion-ui/bloom-menu` | `rn-motion-ui/morphing-menu` |
| `BloomMenu` | `MorphingMenu` |
| `BloomMenuProps` | `MorphingMenuProps` |
| `BloomMenuItem` | `MorphingMenuItem` |
| `BloomIcon` | `MorphingIcon` |
| `BloomIconProps` | `MorphingIconProps` |

The two new props are independent, like the rest of the menu family:

- **`closeOnOutsidePress`** (`boolean`, default `true`) — whether tapping/clicking
  outside the morph card closes it.
- **`overlay`** (`boolean`, default `false`) — whether the dimming scrim renders
  behind the card. Unlike the other menus, which default it to `true`,
  `MorphingMenu` defaults it to `false`: like `MorphingFab`, it morphs in place
  over the page with no scrim. The old `BloomMenu` had no scrim either, so the
  default rendering is unchanged; pass `overlay` to opt into one.

The stories gain the shared `Show overlay` / `Close on outside` toggles, with the
overlay toggle starting off to match the new default.
