---
'rn-motion-ui': minor
---

refactor(menus)!: the anchored panels fill themselves with `Menu`

`Menu` arrived as the list you _could_ put inside a panel. This makes it the
list the panels actually use. `HoldContextMenu` had its own row component — a
port of react-native-hold-menu's `MenuItem`, with its own hover and press fills,
its own disabled dimming, its own heading branch — which is now a second
implementation of something this package already has. It is gone, and the panel
renders a `Menu`.

`hold-context-menu-row.tsx` is deleted. Nothing imported it directly: it was
never an entry point, and both types it exported (`HoldContextMenuItem`,
`HoldContextMenuIcon`) are still exported from `rn-motion-ui/hold-context-menu`.
The item type is unchanged and stays the component's public API — it reads in
upstream's vocabulary (`heading`, `separator`) rather than `Menu`'s, so a new
`hold-context-menu-item.ts` translates one into the other.

**The rows look different.** Adopting `Menu`'s row means adopting its layout:

- the icon **leads** the label instead of trailing it
- a `heading` row is `Menu`'s group caption — left-aligned and muted, where it
  used to be centred
- rows are shorter (44 → 32px floor), and the heading with them (34 → 24px)
- the hairline under **every** row is gone. Only a row with `separator: true`
  draws anything, and what it draws is the band that ends a group

**Breaking:** the panel's testID is now `` `${testID}-panel` ``; it used to be
`` `${testID}-menu` ``. Row testIDs are unchanged
(`` `${testID}-menu-item-<id>` ``). Queries by role are unaffected.

**`role="menu"` moved onto the list.** The panel used to carry it while the rows
carried `menuitem`, with a wrapper in between; now the element with the role
owns its rows directly, and there is no chance of one menu nesting inside
another. The accessible name moved with it, so `accessibilityLabel` still names
the menu.

**`Menu` now owns its vertical inset.** Asking every container to remember
`contentClassName="p-1"` was the wrong split: the clearance the first and last
row need from a rounded panel corner is the same in every panel that holds the
list, and forgetting it left rows sitting against the corner. So the list caps
itself top and bottom (`py-2.5`) and still draws no horizontal padding, no
surface, no border, no radius, no width. Retune it with `className="py-*"`, or
`py-0` to drop it — `HoldContextMenu` pins its own, because it has to predict
its height before layout and wants a number it chose.

Also in `Menu`: a separator is a 4px band with margins around it (12px total at
`md`) rather than a 1px hairline, group captions sit tighter to the group they
name, and `MENU_SEPARATOR_HEIGHT` is exported for panels that have to predict
their own height before layout.

`HoldContextMenu`'s pre-layout height estimate follows the new metrics, and now
counts the panel's border and the list's inset once rather than leaving them
out. `HOLD_MENU_MIN_PANEL_HEIGHT` is the floor a panel is clamped to — border,
inset and one row, so the row that survives the clamp is a whole one.

`CommandPalette` caps its scroller with `max-h-[60vh]` instead of measuring
`useWindowDimensions()`. uniwind compiles `vh` against the same window
dimensions and the same resize event, so this is the same height with one less
hook.
