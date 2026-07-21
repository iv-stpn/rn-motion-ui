---
"rn-motion-ui": minor
---

Add `className`/`style` support to all components; extend Button variants; port Input improvements from offkeep

**Button / StatefulButton**
- New variants: `destructive`, `outlineDanger`, `ghostDanger`, `ghostPrimary`
- New props: `className`, `leftAdornment`, `rightAdornment`, `fitWidth`
- `className` is merged onto the outer `MotiView` wrapper using `cn()`

**Input**
- Shape prop: `rounded` (default) | `pill` — replaces the old always-pill layout
- Size prop: `sm` | `md` (default) | `lg`
- `inputType` prop: semantic type (`text`, `email`, `password`, `otp`, …) — auto-configures `keyboardType`, `autoComplete`, `textContentType`, `secureTextEntry`, `autoCapitalize`
- New props: `className`, `inputClassName`, `hint`, `invalid`, `multiline`, `autoFocus`, `ref`
- iOS: `clearButtonMode="while-editing"` on single-line fields
- Accessibility: `allowFontScaling`, `maxFontSizeMultiplier={1.45}`

**All other components**
- Every component now accepts `className?: string` (NativeWind classes merged onto the outer container) and `style?: StyleProp<ViewStyle>` where previously missing.

**Shared utility**
- New `cn()` helper at `src/lib/cn.ts` — joins truthy class strings (additive, no conflict resolution)
