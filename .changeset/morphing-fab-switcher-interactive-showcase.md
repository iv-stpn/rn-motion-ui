---
'rn-motion-ui': patch
---

showcase size and glass variants in the MorphingFAB / MorphingSwitcher interactive stories

The two `Interactive` playgrounds now expose the morph shells' knobs as live
controls instead of only in their dedicated `Frosted` / `AllSizes` stories.

- **MorphingFAB** — a `Size` choice drives the collapsed trigger along the
  shared interactive ramp (`sm`/`md`/`lg`), and a `Glass` toggle swaps the solid
  shell for the frosted `Surface` (backdrop blur + tint + rim). Coloured shapes
  sit behind the FAB so the blur has something to read.
- **MorphingSwitcher** — a `Glass` toggle does the same for the switcher shell,
  with coloured shapes behind the trigger/pane for a visible backdrop-blur read.
