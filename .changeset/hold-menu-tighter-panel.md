---
'rn-motion-ui': patch
---

feat(HoldMenu): tighten the panel to 40% of the window width

The menu panel followed upstream's 60% window-width sizing. It now uses a
tighter 40%, so the surface sits closer to the held item and leaves more of
the underlying screen visible. The four upstream example screens in
Storybook are consolidated behind a single `Interactive` toggle.
