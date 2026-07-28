---
"rn-motion-ui": minor
---

Per-entry `testID`s in the file browsers, so every row/tile is addressable on its own. The id is keyed by the path that already identifies the entry (folders keep their trailing slash), the way `Table` keys rows by id. No new props: the ids derive from the component's root `testID`, falling back to the component name when it is omitted.

- `FileTree` — each row is `${testID ?? 'file-tree'}-row-${path}`. A row pinned by the sticky headers is a second copy of a row that may also be in the list below it, so it takes `${testID ?? 'file-tree'}-sticky-row-${path}` instead — one query resolves to one node, whichever copy a test means. Previously every row shared a single `${testID}-row`.
- `FileSystem` — each entry is `${testID ?? 'file-system'}-entry-${path}`, the same id in all four views (list rows, icons tiles, columns rows, gallery filmstrip tiles), so a test that switches views keeps its queries.

Additional per-item `testID`s, filling the gaps left by the previous release:

- `CardChoice` — accepts `testID` and forwards it to the card `Pressable` (standalone or inside a `CardChoiceGroup`). Inside a group it now defaults to `${group testID ?? 'card-choice-group'}-card-${value}`, keyed by the `value` that already identifies the card, so cards are addressable without threading ids through each one. The radio ring is `-ring`, its standalone dot `-dot`, the badge `-badge`, and the group's gliding indicator `${testID ?? 'card-choice-group'}-indicator`. A standalone card has no group and no `value` to key on, so its inner ids only appear when you pass a `testID`.
- `RadioGroupItem` — each item defaults to `${group testID ?? 'radio-group'}-item-${value}`, with the ring at `-control` and the group's gliding indicator at `${testID ?? 'radio-group'}-indicator`. Previously only an explicitly passed `testID` reached the item's `Pressable`.
- `CommandItem` — new optional `testID` field; forwarded to each row's `Pressable` in `CommandPalette`.
- `BouncyAccordionItem` — new optional `testID` field; forwarded to each row's trigger `Pressable`.
- `TabsContent` — accepts `testID` and forwards it to the content wrapper.
