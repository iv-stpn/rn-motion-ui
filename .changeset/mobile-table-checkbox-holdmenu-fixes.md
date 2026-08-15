---
'rn-motion-ui': patch
---

fix(ui): mobile Table virtualization, checkbox fill seam, and hold-menu trigger flicker

- **Table**: `removeClippedSubviews` is now explicitly `false`. Android defaults it
  to `true`, and the FlatList is nested inside a ScrollView (the horizontal
  overflow wrapper a phone screen always triggers, or a consumer's vertical one)
  — native view clipping there detaches visible cells, so the table renders
  blank or stalls trying to keep every row mounted. The JS windowing props
  (`windowSize`, `maxToRenderPerBatch`, `initialNumToRender`) are what virtualize.
- **Checkbox / CheckboxCard**: the checked fill now covers the whole 2px border
  band (`-inset-0.5` instead of `-inset-px` / `inset-0`), so the border's
  antialiased inner edge no longer shows as a hairline of the unchecked
  background between the border and the fill.
- **HoldContextMenu**: the trigger stays at `HOLD_ITEM_SCALE` while the lifted
  copy takes over, instead of springing back to 1 mid-handover — the in-place
  item no longer visibly pops/resets under the finger when the menu opens.
