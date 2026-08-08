---
'@rn-motion-ui/ui': minor
'@rn-motion-ui/storybook-native': patch
---

- **Table**: new `columnLayoutStyle()` utility for consistent column width resolution across header, row cells, and skeleton pulses; `containerWidth` removed from `HeaderCell`, `RowCell`, `TableRow`, and `SkeletonCellPulse` — each now uses `columnLayoutStyle(column.width, colWidth)` internally
- **Table**: horizontal `ScrollView` now only wraps the header + body when columns actually overflow the container; when they fit, no scroll wrapper is added, avoiding responder-tree interference with long-press menus and the column-reorder drop indicator
- **Table**: FlatList performance tuned with `windowSize`, `maxToRenderPerBatch`, `initialNumToRender`, `updateCellsBatchingPeriod`, and `nestedScrollEnabled` for smoother large-table rendering
- **BottomSheet**: replaced `flex-1` with `grow` in the sheet body for UniWind v4 compatibility
- Replaced template-literal `className` concatenation with the `cn()` utility across `FeedbackWidget`, `Checkbox`, `StarRating`, `Switch`, `AdaptiveDropdown`, `AdaptiveModal`, `BottomSheet`, `FullSheet`, `HoverMenu`, `MorphingModal`, and `Popover`
