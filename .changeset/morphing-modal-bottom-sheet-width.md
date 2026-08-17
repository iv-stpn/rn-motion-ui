---
'rn-motion-ui': patch
---

fix(MorphingModal): bottom-sheet width matches bottom placement

The bottom-sheet positioner lacked the `px-4` horizontal inset the
`bottom` placement applies, so on phones the sheet rendered up to 32px
wider than the bottom card (both cap at `max-w-sm`). Adding `px-4` makes
the two placements share the exact same width at every viewport size.
