---
"rn-motion-ui": minor
---

Table: add small-screen card view; Checkbox: animate fill with MotiView

**Table**

- New `renderSmallScreen` prop: a render function `(row, selected) => ReactNode` that replaces the column layout with a custom card per row.
- New `useSmallScreen` boolean prop: when `true` (and `renderSmallScreen` is provided), switches the table into card mode — the sticky header is hidden and each row is rendered via `renderSmallScreen` inside a `Pressable` card.
- New `cardStyle` prop: optional style applied to each card container in card mode.
- Card mode provides its own skeleton loading state (three placeholder lines per card) and skips `getItemLayout` so variable-height cards scroll correctly.
- New `SmallScreen` story with a toggle to switch between table and card views.

**Checkbox**

- Replaced the `cva`-based box colour swap with a `MotiView` animated fill overlay. The primary fill now fades in and out at 160 ms (or instantly when `reduce` is on) instead of switching via class variants, matching the mark animation timing.
- Removed the unused `cva` import.
