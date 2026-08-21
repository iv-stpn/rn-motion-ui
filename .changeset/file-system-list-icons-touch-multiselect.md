---
'rn-motion-ui': patch
---

fix(FileSystem): drop touch long-press multiselect from the web list and icons views

The `list` and `icons` views wired the touch long-press join (`onLongPress` from
`useEntryActivation`) into every row/tile, so holding one entry then another on
a touch screen accumulated a multi-selection. Those views are web surfaces — on
the web the hold gesture is inert and multiselect is Ctrl/Cmd-click and
Shift-click — so the touch join is now left unwired: a long-press falls through
to the entry's context menu, matching the `single`-mode behavior. Web
Ctrl/Cmd-click and Shift-click multiselect are unchanged, and the dedicated
`mobile-list` / `mobile-grid` views keep their long-press way into multi-select.
