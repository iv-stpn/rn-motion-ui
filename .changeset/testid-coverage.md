---
"rn-motion-ui": minor
---

Comprehensive `testID` coverage across all components.

**New root `testID` props** on components that previously had none: `ActionFeedbackModal`, `AdaptiveDropdown`, `AdaptiveModal`, `BottomSheet`, `FileSystem`, `FullSheet`, `HoverMenu`, `MultiStepMenu`.

**Sub-element and per-item `testID` support:**

- `TabsTrigger` — accepts `testID` and forwards it to the trigger `Pressable`.
- `BloomMenuItem` — new optional `testID` field; forwarded to each grid cell `Pressable`.
- `OverflowActionItem` — new optional `testID` field; forwarded to each action `Pressable`. The toggle button auto-derives `${testID}-toggle` from the container's `testID`.
- `HoverMenu` — panel `Pressable` auto-derives `${testID}-panel`.
- `AdaptiveDropdown` — floating panel `Pressable` auto-derives `${testID}-panel`.
- `BottomSheet` — overlay backdrop `Pressable` auto-derives `${testID}-backdrop`.
- `ActionFeedbackModal` — dismiss button auto-derives `${testID}-dismiss`.
- `FileSystem` — header, body, and status bar auto-derive `${testID}-header`, `${testID}-body`, and `${testID}-status`.

Components that already forwarded `testID` via `...props` spread (`Text`, `Skeleton`, `AnimatedList`, `Card`) are unchanged.
