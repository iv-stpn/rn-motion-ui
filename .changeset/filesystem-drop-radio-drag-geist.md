---
"rn-motion-ui": patch
---

**FileSystem drop target, RadioCard variant, Draggable Safari fix, Geist fonts**

**FileSystem:** Drop target feedback refactored — `FileSystemDropOutline` (a separate overlay node) is removed; the row itself now lights up with `bg-info` when a drag hovers over it. Selected rows mute during drag, and lifting rows use `bg-muted` instead of `bg-surface-hover`. The column and list views share the same pattern via a `renderBody(isOver)` closure.

**RadioCard:** New `variant` prop — `"radio"` (default, shows the ring + dot indicator) and `"card"` (uses only the animated border and background tint). Settable per-card or at the group level.

**Drag & drop:** `endDrag` now handles bogus `dragend` coordinates from Chrome (0,0) and Safari (wrong non-zero) by falling back to the store's tracked point from `moveDrag`. The web dragzone keeps that point in sync via `moveDrag` calls on `dragover` and `drop`. Dragzone eagerly calls `remeasure()` on registration so its rect is ready before the first drag begins. The capture-phase click listener on `draggable`/`holdable` elements is now only added when `cursorMode` is on, fixing a Safari bug where it blocked native drag initiation.

**Geist fonts:** The storybook demo app loads Geist Sans + Geist Mono via `expo-font` (native) and `@font-face` (web). `--font-sans` and `--font-mono` tokens are overridden in both `storybook/demo/global.css` and `storybook/web/global.css`.
