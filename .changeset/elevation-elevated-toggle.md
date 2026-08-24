---
'rn-motion-ui': major
---

feat: replace `variant` with an `elevated` toggle on IconButton/MorphingFAB, and add the same toggle to every surface

**Breaking changes**

- **`IconButton`** — the `variant` prop (`'neutral' | 'elevated'`) is removed, replaced by two independent props:
  - `elevated` (`boolean`, default `true`) — whether the plate casts the `shadow-elevated-N` recipe (drop + dark-mode rim).
  - `elevation` (`0–8`, default `3`) — the surface level, driving the background tint (`bg-surface-N`) and, when `elevated`, the shadow.
- **`MorphingFAB`** — same change: `variant` is removed in favour of `elevated` + `elevation` (both defaulting to `true` / `3`).

**New `elevated` toggle on every other surface**

Every component that already exposed `elevation` (`0–8`) now also takes `elevated` (`boolean`, default `true`). Setting `elevated={false}` drops the `shadow-elevated-N` recipe — the shadow produced by `elevatedShadow()` in `packages/ui/src/lib/elevated.ts` — while keeping the `elevation`-driven background tint, so a surface can sit flat without casting a shadow.

Affected: `Card`, `RadioCard`, `CheckboxCard`, `WheelPicker`, `Dock`, `Drawer`, `BottomSheet`, `Popover`, `FullSheet`, `BloomMenu`, `CloseButton`, `MorphingModal`, `ActionFeedbackModal`, `AdaptiveDropdown`, `AdaptiveModal`, `HoverMenu`, `SwipeableList`, `BouncyAccordion`, and `MorphingSwitcher`.
