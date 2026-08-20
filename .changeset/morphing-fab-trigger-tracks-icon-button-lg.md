---
'rn-motion-ui': patch
---

Make `MorphingFAB`'s collapsed trigger size follow the IconButton `lg` size

- The trigger shell now derives its size from `ICON_BUTTON_LG_SIZE` (48 px)
  instead of a hardcoded `TRIGGER_SIZE`, so the FAB stays the same size as an
  `lg` IconButton.
