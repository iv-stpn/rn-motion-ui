---
"rn-motion-ui": minor
---

`Switch`: heroui-native prop names + compound sub-components

**Breaking:** Props have been renamed to align with heroui-native conventions. Update call sites accordingly — there are no deprecated aliases.

| Old | New |
|-----|-----|
| `checked` | `isSelected` |
| `onCheckedChange` | `onSelectedChange` |
| `disabled` | `isDisabled` |

**Compound sub-components.** `Switch` is now a compound component; the following sub-components are available:

- `Switch.Thumb` — sliding pill thumb. Spring-animated; squishes lightly on press. Accepts a `thumbTransition` override and render-function children `(props: SwitchRenderProps) => ReactNode`.
- `Switch.Label` — pressable label container. Tapping it toggles the switch (like an HTML `<label>`). Disabled automatically when `isDisabled` is set.
- `Switch.StartContent` — absolutely-positioned icon slot on the left (start) side of the track; typically holds an icon visible when the switch is off.
- `Switch.EndContent` — absolutely-positioned icon slot on the right (end) side of the track; typically holds an icon visible when the switch is on.

When no `children` are provided, `<Switch.Thumb>` is rendered automatically, preserving the existing visual behaviour.

**New exports:** `useSwitch()` hook for accessing switch state from within sub-components, and `SwitchRenderProps`, `SwitchThumbProps`, `SwitchLabelProps`, `SwitchContentProps` types.

```tsx
// Before
<Switch checked={on} onCheckedChange={setOn} disabled={false} label="Enable" />

// After — basic (drop-in)
<Switch isSelected={on} onSelectedChange={setOn} isDisabled={false} label="Enable" />

// After — custom thumb with icon slots
<Switch isSelected={on} onSelectedChange={setOn}>
  <Switch.StartContent><MoonIcon /></Switch.StartContent>
  <Switch.Thumb />
  <Switch.EndContent><SunIcon /></Switch.EndContent>
</Switch>
```
