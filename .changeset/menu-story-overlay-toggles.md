---
'rn-motion-ui': patch
---

docs(menus): add `Show overlay` / `Close on outside` toggles to every menu story

Every menu's `Interactive` playground now exposes the same two live controls —
`Show overlay` and `Close on outside` — driving the `overlay` and
`closeOnOutsidePress` props, so the overlay/outside-press behaviour can be
flipped at runtime instead of read back out of the code.

`FullSheet` is the exception: a full-screen sheet has no outside region or scrim
to toggle, so it keeps its `dismissable` control. The `MorphingMenu` playground's
overlay toggle starts off, matching that component's new no-scrim default.
