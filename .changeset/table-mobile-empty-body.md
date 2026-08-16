---
'rn-motion-ui': patch
---

fix(ui): Table body no longer renders empty on narrow screens

- **Table**: when columns overflow a phone-width container the table wraps its
  header row and body `FlatList` in a horizontal `ScrollView`. That ScrollView
  lays its content container out in `flex-direction: row`, and the header and
  body were siblings of a fragment — so they landed side by side and the body
  `FlatList` sat off-screen to the right of the header, reading as an empty
  table. The header and body are now wrapped in a single column `View` with an
  explicit `width` (the summed column widths), so they stack vertically, keep
  their column edges aligned, and still scroll horizontally together.
