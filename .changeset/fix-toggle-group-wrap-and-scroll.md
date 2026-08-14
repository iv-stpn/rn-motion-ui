---
"rn-motion-ui": patch
---

**ToggleGroup: wrap on overflow, scroll segmented controls**

- **`spaced` wraps** — a spaced group now flows onto additional lines when it runs out of width instead of overflowing its container.
- **`bordered` / `connected` scroll** — segmented controls scroll horizontally and clip at their edge rather than overflowing, so a long option list stays usable in a narrow layout.
