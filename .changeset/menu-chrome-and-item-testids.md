---
'rn-motion-ui': patch
---

Let `MultiStepMenu` name its own chrome and `HoldMenuItem` name its rows, so both are addressable by id instead of by matching text.

`MultiStepMenu` took a `testID` and put it on the modal shell alone, which left its close and back controls reachable only through their `accessibilityLabel` — a query two menus on screen both answer. The shell's `testID` now reaches the chrome as well: `<testID>-close` and `<testID>-back`. The wide and small chrome are built by mutually exclusive branches, so each id names exactly one control at a time, and the split is not symmetric — the wide layout shows its ✕ at every depth and its back chevron only from the second level down, while the small layout shows its back arrow at the root and its ✕ only once there is a parent to return to. The ids follow the controls that actually exist, so an absent one stays absent rather than resolving to something else.

`HoldMenuItem` had no `testID` at all, which meant the panel's `hold-menu-panel` was the only handle a test had: to press a given row you matched its label and scoped it to an ancestor. That holds only while one menu is open, and a row's menu routinely repeats the same labels across a list — every file-system entry and every chat bubble offers Delete. `MenuItemProps` now takes an optional `testID`, threaded onto the row through the same path the generic `Menu` already honoured, so a row can be named after the item it belongs to (`whatsapp-delete`) rather than after the text it happens to share.

Both are additive: with no `testID` passed, nothing is named and rendering is unchanged.
