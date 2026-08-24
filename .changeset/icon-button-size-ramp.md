---
'rn-motion-ui': patch
---

feat: align IconButton and MorphingSwitcher heights with the Button ramp; add a `size` prop to MorphingSwitcher

- **IconButton `lg` now sits on the shared interactive ramp.** It was 48px (an off-ramp step reserved for MorphingFAB's trigger); it is now 40px, exactly matching `Button`/`ActionSwap` at `lg`. `sm`/`md`/`lg` (24/32/40px) line up across the family, and the tile/icon ratios inside `lg` were re-proportioned to keep the same ring of breathing room.
- **MorphingFAB's trigger stays circle-sized.** Its trigger was driven by `ICON_BUTTON_LG_SIZE`, so it now stands at 40px with a matching 20px radius — no visual change in proportion, just the shared size.
- **MorphingSwitcher gains `size` (`sm` | `md` | `lg`, default `md`).** The trigger and every item row now stand at the shared interactive height (24/32/40px), with icon, label, caret, and pane radius scaling to suit. Previously it was a fixed 36px.
