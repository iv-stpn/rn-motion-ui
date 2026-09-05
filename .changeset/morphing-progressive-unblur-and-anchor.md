---
'rn-motion-ui': patch
---

fix(MorphingFAB/Switcher): progressive unblur on close + stable teleported anchor

Closing a MorphingFAB or MorphingSwitcher with an `overlay` scrim now fades the
blur and dim out over 200 ms instead of popping them off in the same frame the
pane starts folding — the same progressive unblur the scrim's enter already
had. The outside-press dim layer fades in/out through its own opacity (the
blur stays a sibling layer, so its `backdrop-filter` is never clipped by an
animated ancestor on web).

The Android-teleported FAB/Switcher also re-measures its window anchor once the
initial layout settles and ignores stale `measureInWindow` callbacks, so the
closed trigger no longer rests at a pre-settle position (an ancestor centering
or chrome shift after mount moves the FAB without firing its own `onLayout`)
until the first open corrects it.
