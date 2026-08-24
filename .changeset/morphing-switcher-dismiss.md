---
'rn-motion-ui': patch
---

fix(MorphingSwitcher): dismiss on outside press on native + re-tap of the selected item folds the pane

- **Outside press now closes on every platform.** Web already listened on the document; native gets a full-window transparent backdrop measured from the root's window position (negative offsets inside the small root), so a tap anywhere outside the pane folds it back on mobile too.
- **The open trigger only LOOKS disabled — it is not.** The trigger is the selected item's row, so it still paints `opacity-40` (the disabled look), but the `disabled` prop is gone and re-tapping it closes the pane, the standard select/dropdown dismissal. `closeOnOutsidePress` gates both paths.
