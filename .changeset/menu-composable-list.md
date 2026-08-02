---
'rn-motion-ui': minor
---

feat(Menu): composable menu list for dropdowns and context menus

`Menu` takes an `entries` array and renders the inside of a menu — action rows,
separators, group labels, and arbitrary nodes — so consumers stop hand-rolling a
`View` full of `MenuItem`s. Entries compose with `&&`, so a conditional row is
just `condition && { id, label, onSelect }`; falsy entries are dropped.

Four entry kinds, discriminated on `type`, which is optional for the common one:

- `{ id, label, onSelect }` — an action row (`type: 'item'` implied)
- `{ type: 'separator' }`
- `{ type: 'label', label }` — a non-interactive group caption
- `{ type: 'node', node }`, or a bare `ReactElement` as shorthand

It carries the semantics (`role="menu"`, `role="menuitem"`, `accessibilityState`,
`aria-disabled`, `role="presentation"` on captions), closes the panel before
running the action so a navigating row does not strand a modal, and aligns labels
across a mixed list via an auto-detected icon gutter (`iconGutter`).

`Menu` owns no frame: no background, border, radius, width, or horizontal
padding. The surface belongs to whatever holds it — `AdaptiveDropdown`'s panel,
`HoldContextMenu`'s, a `Card`, a sidebar column. The one exception is the
vertical inset, which the list keeps for itself so the end rows clear a rounded
panel corner without every container having to remember to pad for them.

Also: `MenuItem` gains a `destructive` prop (danger-tinted label and icon, with
the `bg-info` active fill still winning over it) and now dims while `disabled`.
