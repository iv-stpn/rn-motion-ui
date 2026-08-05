---
"rn-motion-ui": minor
---

**Menu**: captions, separators and node entries are addressable by `testID`.

Give the list a `testID` and every action row already derives one from it —
`${testID}-item-${id}`, which is how `HoldContextMenu`'s rows have been reachable
in a test. The other three entry kinds got nothing, and they are the ones with no
alternative: a caption is `role="presentation"` and a separator is a bare band, so
neither carries a role or an accessible name to query by. Selecting them meant
`getByText` against user-facing copy, or nothing at all.

Each non-action entry now takes the list's `testID` plus the React key the list
had already assigned it:

```tsx
<Menu
  testID="row-actions"
  entries={[
    { type: 'label', id: 'group', label: 'Message' }, // row-actions-group
    { id: 'reply', label: 'Reply', onSelect: reply }, // row-actions-item-reply
    { type: 'separator', id: 'after-reply' },         // row-actions-after-reply
    { type: 'separator' },                            // row-actions-separator-0
  ]}
/>
```

An entry with an `id` is named by it. One without falls back to the same per-type
running count that already keys it — and that count only advances for the unnamed
ones, so the numbering is positional among *them* rather than among all separators.
Pin an `id` on anything you plan to select. Any entry can also set `testID`
outright to override the derivation, as action rows could already.

`MenuSeparator` and `MenuLabel` take a `testID` too, so a `node` entry drawing its
own matching hairline can name it the same way the list would have.

**HoldContextMenu** inherits this: its panel already passes `${testID}-menu` down,
so a `heading` row is now `${testID}-menu-<id>` and the band a `separator: true`
row ends its group with is `${testID}-menu-<id>-separator`.
