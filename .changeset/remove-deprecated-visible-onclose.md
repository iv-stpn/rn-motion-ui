---
"rn-motion-ui": major
---

Remove deprecated `visible`/`onClose` props and clean up internal comments

**Breaking:** `visible` and `onClose` props have been removed from `BottomSheet`, `FullSheet`, `AdaptiveModal`, and `ActionFeedbackModal`. These were deprecated aliases introduced in the previous minor. Migrate to `open` and `onOpenChange`:

```tsx
// Before
<BottomSheet visible={open} onClose={close} />
<FullSheet visible={open} onClose={close} />
<AdaptiveModal visible={open} onClose={close} />
<ActionFeedbackModal visible={open} onClose={close} />

// After
<BottomSheet open={open} onOpenChange={close} />
<FullSheet open={open} onOpenChange={close} />
<AdaptiveModal open={open} onOpenChange={close} />
<ActionFeedbackModal open={open} onOpenChange={close} />
```

**Breaking:** `state?: never` has been removed from `MotiPressableProps`. It was a no-op guard and carries no runtime effect.

Internal call sites (`AdaptiveDropdown`, `CommandPalette`, `MultiStepMenu`) have been updated to the new API. The `PopoverCtx` internal type is renamed to `PopoverContext` (unexported; no public API change). Inline `RN FALLBACK vs web` implementation notes have been removed from component files.
