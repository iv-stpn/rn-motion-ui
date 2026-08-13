---
"rn-motion-ui": patch
---

**FileSystem: deterministic overlay-dropzone testID**

- The expanded-folder overlay dropzone now renders a stable `testID` (`file-system-overlay-dropzone`) the moment it has measured and won the hit test. Tests can await it as the signal that an in-flight drag's overlays are settled, instead of relying on a fixed number of timer ticks that races under load.
