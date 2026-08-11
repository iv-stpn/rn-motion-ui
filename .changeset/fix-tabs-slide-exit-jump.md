---
"rn-motion-ui": patch
---

**Tabs: fix slide panel jumping above the tab bar on exit**

The `slide` content animation pins the exiting panel to its last in-flow position with `position: absolute` so it can translate away while the entering panel takes its place. The `absolute` class was applied, but the captured `top`/`left`/`width`/`height` frame values were never passed as inline styles — without them, the absolutely positioned panel defaulted to the parent's origin (top-left), which sits above the tab bar. The fix adds the missing `style` prop so the exiting panel holds its spot for the full push.
