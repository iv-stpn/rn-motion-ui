---
'rn-motion-ui': patch
---

fix(HoldMenu): keep the held item visible when the twin lifts away

The in-place item hid under the portal twin on every activation, so when the
twin travelled to a different y (the menu overflowing and lifting the pair)
the original still faded out underneath — needlessly, since the two no longer
overlap. The cross-fade now runs only when the twin stays put; when it
travels the original holds its full opacity while the twin lifts away. Also
adds a nested card-scroll story that holds items inside two levels of scroll
view, so the twin's scroll-aware placement is demonstrable.
