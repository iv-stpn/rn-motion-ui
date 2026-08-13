---
"rn-motion-ui": patch
---

**WheelPicker: commit the value at rest, and snap the wheel consistently**

- **Value commits once the drum settles** — `onValueChange` now fires only when a gesture ends and the landing row is locked (release, tap, wheel idle, key step), instead of emitting every row the drum crosses mid-drag. The settle spring still animates the drum visually, but the value is already determined at that point, so a coast never machine-guns intermediate rows.
- **Wheel snaps at the 50% threshold everywhere** — wheel delta is normalised through Chromium/WebKit's legacy `wheelDelta` (a uniform −120 per detent) rather than pixel-mode `deltaY`, which reports 4px on a macOS mouse versus 100px on Windows for the same notch. A macOS notch previously moved the drum 0.048 rows and always reverted; it now advances a consistent, `Math.round`-snapped amount, so passing half the next row lands on it.
