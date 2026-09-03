---
'rn-motion-ui': patch
---

Replace the `Button`/`ElevatedButton` loading spinner with three staggered bouncing dots, matching `StatefulButton`'s loader so the whole button family reads consistently while busy. The dots use the same imperative Reanimated loop as the old spinner to avoid the moti `loop` re-render freeze.
