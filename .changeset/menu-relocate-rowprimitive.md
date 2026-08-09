---
"rn-motion-ui": patch
---

**Relocate Menu + MenuItem to `RowPrimitive/`**

`Menu` and `MenuItem` move from `menus/Menu/` and `menus/MenuItem/` to the new `RowPrimitive/` directory. All import paths updated across AdaptiveDropdown, AdaptiveModal, CommandPalette, HoldContextMenu, HoverMenu, and FileSystem. Old files deleted.

Menu vertical padding switched from a hardcoded `py-2.5` to the new `py-(--menu-vertical-padding)` CSS token so the inset stays in sync with the design system. MenuItem row gap reduced from `gap-3` to `gap-2`.
