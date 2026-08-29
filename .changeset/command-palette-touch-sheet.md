---
'rn-motion-ui': patch
---

fix(CommandPalette): hide shortcut hints and swap the ESC chip for a close button on touch screens

The palette renders as a centred modal on wide (≥ `sm`) screens but as a full
touch sheet on narrow ones, where keyboard-shortcut hints are meaningless and no
hardware ESC key exists. Row shortcut hints are now hidden and the `ESC` chip is
replaced by a proper `CloseButton` in the top right on narrow screens; wide
screens keep the `ESC` chip and show each item's shortcut hint.
