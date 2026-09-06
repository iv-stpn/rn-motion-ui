---
'rn-motion-ui': patch
---

fix(Input): centre text vertically in single-line inputs on iOS

- New `input-vcenter` utility zeroes the line-height on iOS (via `@variant ios`)
  and sets `textAlignVertical: center` on Android, so a single-line `TextInput`
  no longer bottom-aligns its glyphs against the field height.
- Applied to `Input` (single-line only — multiline keeps its line-height), the
  `CommandPalette` search field, and the `Table` column-rename input.
