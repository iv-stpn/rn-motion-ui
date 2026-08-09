---
"rn-motion-ui": patch
---

**`usePressState` hook: centralise pressed-state bookkeeping; `useControlledValue`: extract controlled/uncontrolled seam**

New `usePressState` hook replaces ad-hoc `useState(false)` + `useCallback` pairs across 13 components (Checkbox, CheckboxCard, Radio, StarRating, Switch, ActionSwap, CloseButton, OverflowActions, Dock, Tabs, ScrollTo, ActionRow, MenuItem). Returns `{ pressed, pressHandlers }` — spread `pressHandlers` onto `Pressable` and use `pressed` for animations. Accepts optional `onPressIn`/`onPressOut` forwarding for callers that also need the events.

New `useControlledValue` hook replaces three duplicated controlled/uncontrolled seams: `useCalendar`'s inline `useControlled`, `useDatePicker`'s `useDisclosure`, and `useDateRangePicker`'s `useDisclosure`.

**Button: `contentStyle` → `contentClassName`**

`BaseButtonProps.contentStyle` (inline `ViewStyle`) becomes `contentClassName` (Tailwind string). All button variants (Button, ElevatedButton, GlossyButton, StatefulButton) and `ButtonGroup` updated. StatefulButton's `STATE_PAD_SQUEEZE` numeric constant becomes `SQUEEZE_PADDING_CLASS` (Tailwind classes per size). ButtonGroup's `borderedContentStyle()` returns a class string instead of a `ViewStyle` object.

**`elevated.ts`: derive `SURFACE_CLASSNAME` from private lookups**

`SURFACE_CLASSNAME` entries are now built from `SURFACE_BG_CLASSNAME` + `SURFACE_ELEVATED_SHADOW_CLASSNAME` instead of hardcoded duplicates. `elevated()` delegates to `surfaceBackground()` and `elevatedShadow()`.

**RowPrimitive: extract `groupedRowClass`; fix sections container + dividers**

`groupedRowClass()` is a shared helper used by both `ActionRowGroup` and `ItemRowGroup`. The `sections` variant divider (`h-px bg-border`) moves out of the per-group item loops and into `RowGroupContainer`, which now wraps its children with `my-2`-spaced dividers and uses `elevated(3)` + `rounded-card` instead of the old `rounded-2xl bg-surface-3 p-4`.

**FileSystem: extract `useFileSystemRowInteraction` and `useFileSystemDragOptions`**

Two new hooks replace duplicated code across all five views (column, list, gallery strip, icons tile, search): `useFileSystemRowInteraction` handles context-menu + hold-prevention bookkeeping; `useFileSystemDragOptions` resolves multi-drag payloads. Each view drops ~30 lines of identical inline logic.

**FileSystem store: `navigationPatch` convergence, `recomputeAndSet` helper**

`historyStep` renamed to `navigationPatch`, which `navigateTo` now delegates to instead of duplicating the patch. A `recomputeAndSet` helper cuts repetition across `applySortKey`, `toggleSortColumn`, and `_setItems`. `nextFileTypeFilters` takes a `nextId` factory instead of a pre-generated id.

**OtpInput: flexbox centring replaces `lineHeight` trick**

Each slot's digit animates inside a `MotiView` with `items-center justify-center` instead of a `MotiText` with a hardcoded `lineHeight: 44`, so the digit stays vertically centred regardless of slot size.

**DnDList: smoother reorder animations**

Reorder durations increased from 200→300ms; pushed-row easing switched from `linear` to `Easing.bezier(0.16, 1, 0.3, 1)`. Story examples gain `transition-all duration-300 ease-out`.

**Button stories: fix icon colours for `secondary` variant**

`iconColorFor` now resolves `secondary` to `surface-1`. Story examples using `secondary` variant icons switch from `colors.foreground` to `colors['surface-1']`.
