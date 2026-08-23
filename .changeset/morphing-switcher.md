---
'rn-motion-ui': minor
---

feat(Display): add `MorphingSwitcher` — a pill-shaped switcher whose trigger morphs into the full item list on press, like `MorphingFAB`. Collapsed it shows the current item's icon + label + a down-caret; tapping springs the shell open into a rounded pane listing every item (active highlighted), and picking one reports it via `onValueChange` and folds the switcher back. The caret flips up while open and doubles as the close control. Supports controlled/uncontrolled value + open state, `expandedWidth`/`expandedHeight`, optional `closeIcon`, reduced motion, and per-item testIDs.
