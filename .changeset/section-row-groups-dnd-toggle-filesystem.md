---
"rn-motion-ui": patch
---

**RowPrimitive: split row-group into per-component files, add sections variant, and enrich adornments**

- `ActionRowGroup` and `ItemRowGroup` extracted from `row-group.tsx` into their own files (`action-row-group.tsx`, `item-row-group.tsx`). `RowGroupContainer` stays in `row-group.tsx` as the shared internal shell.
- New `sections` variant: renders rows in a padded surface-3 container with horizontal rule dividers between items; the grouped variant now correctly adjusts corner radii per position.
- `ItemRowAdornment` icon objects now accept `iconColor` and `iconBackgroundColor` — the latter draws a tinted circular badge behind the icon.
- Left adornments now default to `muted-foreground` instead of `foreground`.

**Button system: vertical press animations and toggle-group signalling**

- New `pressMode` values — `scaleX`, `scaleXFirst`, `scaleXLast` — animate buttons in vertical groups: first nudges up, last nudges down, middle collapse horizontally.
- `ButtonGroup` applies the appropriate vertical press mode and softens inner-border dividers to `/50` opacity, removing the `-ml-px`/`-mt-px` overlap hack.
- `BaseButtonProps` gains an opaque `value` prop for container components (`ToggleGroup`) to track selection.

**Drag and drop: built-in multi-drag ghost and HTML5 custom previews**

- `MultiDragManager` now provides a default ghost ("N items" chip with a dot) when no `renderPreview` is passed.
- `Draggable` and `HoldDraggable` keep their preview element in the DOM at all times — on-screen for pan transports, off-screen for HTML5 — so the HTML5 transport can call `setDragImage` with the custom ghost instead of the browser's default element screenshot.
- `useDraggableHtml5` gains `setDragImageFromRef` — clones the preview DOM node, appends it to `<body>`, calls `setDragImage`, and removes it on the next microtask.

**FileSystem: row enter/exit animations, multi-move, and stacked ghost**

- `FileSystemAnimatedRow` and `useFileSystemRowAnimation` add smooth enter/exit transitions when entries are added or removed from a column.
- Drag-scope group ghost replaced with a stacked-icon deck (up to 3 items, folder glyphs or file-type icons) plus a count label.
- `handleMove` in the demo now processes all sources in a multi-drag instead of just the first.
- Column row loses `rounded-md` (the animated wrapper now handles it) and `extraData={selectedPaths}` drives FlatList re-renders for selection changes.

**MorphingModal: bottom-sheet placement**

- New `bottom-sheet` placement: full-width panel with rounded top corners only, no max-width constraint, `justify-end` alignment, and a longer enter distance (80px). Press scale is disabled.

**HoldContextMenu: right-click opens menu without firing afterHold**

- `openMenuFromContextMenu` is a separate callback for the DOM `contextmenu` event — it opens the menu but skips the consumer's `afterHold` action so a right-click does not also toggle multi-select.

**Typography: per-weight font-family tokens**

- The `Text` component now resolves each `font` × `weight` pair to a single per-weight family class (`font-sans-bold`, `font-mono-medium`, etc.) via cva compound variants. This is required on native where `fontWeight` alone cannot select between different `.ttf` files.
- Theme tokens expanded from 3 generic font stacks to 12 per-weight tokens (`--font-sans-normal` through `--font-mono-bold`). Geist @font-face declarations in both web and demo updated to match: each weight gets its own font-family.
- `--radius-menu` token added to the theme.

**New components: ToggleGroup and DnDList**

- `ToggleGroup` — form component for mutually-exclusive or multi-select toggle buttons.
- `DnDList` — gesture-driven reorderable list with drag handles, `DnDItem`, and `dndReorder` helper. Both new components are registered in the package exports map.
