---
'rn-motion-ui': patch
---

refactor(Dock/MorphingSwitcher): shared motion primitives and a reworked close

The Dock, MorphingDockSwitch and MorphingSwitcher now share their geometry and
motion instead of each re-deriving it inline:

- **Shared dock geometry** — `dock-metrics` (pure closed-form arithmetic, now
  unit-tested), `dock-motion` (`DockFrame` / `DockHighlight` / `DockContent`) and
  `dock-transition` (`dockSizeMotion`, web-vs-Fabric size handling) replace the
  per-component constants and pill/highlight rendering in `Dock` and
  `MorphingDockSwitch`. The container size now springs via a new
  `SPRING_DOCK_SCALE`, and item slots use static Yoga layout with the moving
  frames keyed off a borderless row so a changed pill no longer restarts the
  spring.

- **Shared switcher close** — `use-switcher-motion` owns the close timeline
  (swell → hold → collapse with a staggered row peel and a content dissolve), and
  `SwitcherMotionRow` renders the per-row exit. Both `MorphingSwitcher` and
  `MorphingDockSwitch` route their pane close through it, so the shell and rows
  read as one motion instead of dissolving first and collapsing a beat later.

- **OutsidePressBackdrop** gains `onPressIn`, so a press that starts outside a
  pane and drags away still dismisses instead of only a completed tap.

No public API change; `dockMetrics`/`dockRowSize` are exported for the motion
checks and `dock-metrics` test.
