---
'@rn-motion-ui/ui': minor
'@rn-motion-ui/storybook-native': patch
---

- **ButtonGroup**: new form component for grouping buttons with segmented, toolbar, and grid layouts
- **FeedbackWidget**: refactored morphing animation using shared layout springs; replaced `AnimatePresence` wrapper with coordinated scale/translate transitions on individual views (`SPRING_SWAP`, `SPRING_LAYOUT`); container now animates `width` instead of just `borderRadius`
- **Input**: added `outline-none` to the text field; fixed iOS text vertical alignment via `textAlignVertical: 'center'` and `lineHeight: 0`
- **FileSystem header**: removed bottom border
- **HoverMenu**: `width="trigger"` now sets `minWidth` from the trigger measurement instead of a fixed `width`, allowing panels to grow wider than the trigger when content overflows
- **MorphingModal**: added `elevation` prop and storybook elevation control
- **AdaptiveModal**: fixed missing `label` on the elevation `Choice` control in storybook
