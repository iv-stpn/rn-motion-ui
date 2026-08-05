---
"rn-motion-ui": minor
---

Seven components now name their repeated children from the root `testID`.

Each of these already took a `testID` and put it on its outer element, which left
the interesting parts unaddressable: the stars, the wheel options, the swipe
actions. A test could reach them only through `accessibilityLabel`, which ties the
selector to user-facing copy, or not at all where the element carries no role and
no name.

| Component | New testIDs |
| --- | --- |
| `StarRating` | `-star-<n>` — both the interactive and `readOnly` paths |
| `WheelPicker` | `-option-<value>` |
| `SwipeableList` | `-row-<id>`, and `-row-<id>-action-<id>` per swipe action |
| `BouncyAccordion` | `-item-<id>` |
| `BloomMenu` | `-item-<index>`, `-trigger`, `-close` |
| `CommandPalette` | `-item-<id>`, `-group-<group>` |
| `OverflowActions` | `-item-<id>` |

Five of the seven add nothing when `testID` is omitted, so a component that does
not ask for one renders exactly as before. The exceptions are `WheelPicker` and
`SwipeableList`, whose roots already defaulted to `'wheel-picker'` and
`'swipeable-list'` — their children derive from that default, so options and rows
are named either way. Where an item type already had its own optional `testID`
(`BouncyAccordion`, `BloomMenu`, `CommandPalette`, `OverflowActions`), it still
wins; the derived name is the fallback.

**Two of these render their children twice, and only the live copy is named.**
`WheelPicker` paints a second `aria-hidden` drum for the bright centre band and
`OverflowActions` keeps an offscreen measurer to feed its width spring; naming
both copies would return two nodes per `getByTestId`. `aria-hidden` does not hide
an element from `getByTestId` the way it hides one from `findByRole`, which is why
the role queries in these components were never ambiguous but the testIDs would
have been.

`OverflowActions` had that bug already: its measurer duplicated any `item.testID`
a caller set, so naming an action made every query for it ambiguous.
`ActionButtonProps` now takes an already-derived `testID` instead of reading
`item.testID` itself, which is what lets the measurer stay silent no matter what
the item carries.

`SwipeableList` keeps its old default. Rows were hardcoded to
`swipeable-row-<id>`, ignoring the root entirely — two lists on one screen
collided. Rows now derive from the root when there is one and fall back to the
old string when there is not, so existing selectors keep working while a named
list gets `<testID>-row-<id>`.

`StarButton` (exported) gains an optional `testID`. `MenuItem` itself is untouched —
it already forwarded one; what changed is the components above it passing a derived
name down.

Four stories now assert through the new IDs rather than around them. `SwipeableList`
is the clearest case: every row repeats the same four action labels, so its old
`findAllByRole('button', { name: 'Trash' })[0]` could assert that *something* was
pressed but not which row, and the buttons sit behind the draggable surface with no
swipe to reveal them in jsdom. It now names the row and the action together and
asserts the payload. The `WheelPicker` and `OverflowActions` plays query by testID
specifically so a single match proves the duplicate copy stayed anonymous.
