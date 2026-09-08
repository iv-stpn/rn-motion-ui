---
'rn-motion-ui': patch
---

feat(MorphingFAB/Switcher): frost the morph shells and let the FAB size off the button ramp

Both morph menus can now host their trigger + pane inside the frosted-glass
`Surface` primitive instead of a solid surface: a positive `blurRadius` swaps the
shell's `MotiView` host for a `<Surface>` (same `key={variant}` remount, same
morph layout), so the collapsing circle/pill reads as glass over whatever sits
behind it.

- **Glass knobs** — new `blurRadius`, `opacity`, `rim`, `rimWidth`, and
  `intensity` props on both `MorphingFAB` and `MorphingSwitcher`, wired straight
  through to the frosted `Surface` and the trigger's `IconButton`. The shell's
  radius follows the morph (full radius on the pane, half the trigger side when
  collapsed), and non-glass rendering keeps the exact solid-surface path it had.
- **FAB size** — `MorphingFAB` gains a `size` prop (`sm`/`md`/`lg`,
  `lg` default). The collapsed trigger and the shell's resting footprint now read
  the shared interactive ramp (`BUTTON_SIZE[size].px`) instead of being pinned to
  `lg`, so a FAB lines up with a `Button` or `IconButton` of the same size.
