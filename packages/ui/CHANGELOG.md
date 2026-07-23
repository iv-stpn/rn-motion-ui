# rn-motion-ui

## 3.1.0

### Minor Changes

- 5550b74: Simplify status token model to vivid filled pairs; rename `destructive` → `danger`; remove `Card` variant prop.

  **Breaking — status token model** (`rn-motion-ui/tokens.css`, `use-theme-color`):

  - The soft-plate triad system (`*-border` partners) is replaced by vivid filled pairs: `danger` / `success` / `warning` / `info` are now saturated filled backgrounds; `*-foreground` is white in both themes for consistent legibility on the fill. The `*-border` tokens (`danger-border`, `success-border`, `warning-border`, `info-border`) are removed entirely.
  - `--color-destructive` / `--color-destructive-foreground` are removed. The unified `danger` pair covers both the former soft plate and the vivid action use-case. Any code referencing `destructive` (CSS variable, Tailwind class `bg-destructive` / `text-destructive`, or `ThemeToken`) must migrate to `danger`.
  - `ThemeToken` (exported from `use-theme-color`) drops `destructive`, `destructive-foreground`, `success-border`, `warning-border`, `info-border`, `danger-border`.

  **Breaking — `Button` variant**:

  - The `'destructive'` variant is renamed `'danger'`. Update any `<Button variant="destructive" />` to `variant="danger"`.

  **Breaking — `Card` `variant` prop removed**:

  - `Card` no longer accepts a `variant` prop (`'border' | 'elevated' | 'filled'`). All cards now render as elevation-based surfaces: background and shadow derive from the `elevation` prop (default `3`). Replace `variant="filled"` with a `className` override, and drop `variant="border"` / `variant="elevated"` (behaviour is equivalent to the former `elevated` with `elevation={3}`).

  **Breaking — `AnimatedBadge` style**:

  - Badge containers are now borderless vivid fills (matching the new status token model). The animated border was removed; the `X` error icon is replaced with `AlertCircle`. Visual appearance changes in all status variants.

  **New — `StarRating` customisation props**:

  - `activeStarColor?: string` — color of filled stars and the sparkle burst. Defaults to a fixed gold (`#edde51`) that reads as a star across every theme.
  - `inactiveStarColor?: string` — color of empty stars. Defaults to the theme `border` token.
  - `round?: boolean` — round stroke caps and joins (default `true`). Set `false` for sharp star points.

  **New — `AdaptiveDropdown` trigger function receives `toggle`**:

  - The render-prop form of `trigger` now receives `{ open, toggle }` instead of `{ open }` only. Use `toggle` when the trigger is itself pressable (e.g. a `Button`) so the inner pressable can wire `onPress` to `toggle` directly, bypassing the outer wrapper's own toggle.

## 3.0.0

### Major Changes

- c2fd8d1: Adopt the cubby-ui surfaces system as the token foundation.

  **Breaking — token model reworked** (`rn-motion-ui/tokens.css`):

  - **Surface elevation ladder**: `--color-surface-1` … `--color-surface-8` with paired `--shadow-surface-1` … `--shadow-surface-8` recipes (crisp 1px ring + progressive drop layers). Surfaces address the ladder directly — `surface-1` is the page, `surface-3` the resting level for contained content (cards, popovers, dialogs, inputs). The shadcn-style container/page aliases (`--color-surface`, `--color-card`, `--color-popover`, `--color-input`) are gone; use `bg-surface-1` / `bg-surface-3` instead. Light mode keeps surfaces neutral and lets shadows carry elevation; dark mode steps lightness per level with a subtle neutral tint (hue 270, chroma 0.004) across the whole neutral stack.
  - **State overlays**: new translucent `--color-surface-hover` / `--color-surface-selected` utilities that composite on any surface level.
  - **Status triads**: `success` / `warning` / `info` / `danger` are now soft plate backgrounds with `*-foreground` (legible text/icon on the plate) and `*-border` partners. The previous vivid `--color-success` / `--color-warning` values are gone — text/icons that used them should use `*-foreground`. `--color-destructive` stays the vivid action color and gains `--color-destructive-foreground`; new `--color-accent` / `--color-accent-foreground`.
  - The undefined `shadow-modal` class (silently no-op) is replaced with real `shadow-surface-N` recipes across overlays; `ThemeToken` (use-theme-color) covers the full new token set.

  **New — `rn-motion-ui/color`**: pure-formula OKLCH → sRGB conversion (`oklchToSrgb`, `cssColorToSrgb`) using the reference OKLab matrices with CSS Color 4 chroma-reduction gamut mapping. `useThemeColor()` now resolves web CSS variables through this deterministic formula instead of rasterising a 1×1 canvas pixel, and the native static maps are derived from the same oklch definitions at module load (no more hand-maintained hex duplicates).

  **New — `elevation` prop + `rn-motion-ui/elevated`**: surface components (`Card`, `Popover`, `AdaptiveDropdown`, `HoverMenu`, `MorphingModal`, `ActionFeedbackModal`, `AdaptiveModal`, `FeedbackWidget`) accept an `elevation` prop (`SurfaceLevel`, `1`–`8`) that drives where the surface sits on the ladder: its background (`bg-surface-N`), its drop shadow, and — in dark mode — its inset rim (top highlight + full-perimeter ring) all track the same level, so the fill and the rim highlight stay calibrated together. Because light-mode surfaces `3`–`8` are all white, coupling the background to elevation is a no-op in light mode; in dark mode a higher `elevation` reads as a lighter, more-floated surface. Backing this is a new `--shadow-elevated-1` … `--shadow-elevated-8` token pair (rim + drop folded into one box-shadow, since React Native has no `::after` to paint cubby's pseudo-element rim) and the `rn-motion-ui/elevated` helper (`elevated`, `elevatedShadow`, `surfaceBackground`, `clampSurfaceLevel`, `SURFACE_LEVELS`, `SurfaceLevel`) mirroring cubby's `surfaceClasses` two-arg (background level / float level) split. The dark stack also gains `--surface-hi-*` highlight and `--surface-ring-*` ring tokens driving the rim recipe.

  Components migrated throughout: modals/sheets/popovers sit at `bg-surface-3` with ladder shadows, tables/lists use `bg-surface-selected` for selected rows, badges/stateful buttons/swipe actions use the status triads, and StarRating's `text-neutral-*` Tailwind-palette stragglers now use `text-muted-foreground`.

## 2.3.0

### Minor Changes

- 865d908: Add motion token constants (`theme/motion.ts`).

  - Duration constants: `DURATION_INSTANT / FAST / BASE / SLOW / SLOWER`
  - Shorthand timing transitions: `TIMING_INSTANT / FAST / BASE / SLOW`
  - Semantic spring presets: `MOTION_SNAPPY`, `MOTION_STANDARD`, `MOTION_GENTLE`, `MOTION_BOUNCY`
  - `mergeTransition` helper for partial consumer overrides
  - Re-exports `MotiTransitionProp` as the canonical transition type

- 425529d: Add `open` / `onOpenChange` props to overlay components.

  `BottomSheet`, `AdaptiveModal`, `FullSheet`, and `MorphingModal` now accept the new controlled props:

  - `open` (replaces `visible`)
  - `onOpenChange(open: boolean)` (replaces `onClose`)

  The previous `visible` / `onClose` props are kept as deprecated aliases and will be removed in a future major release.

- 425529d: Extract shared overlay boilerplate into `OverlayShell` and `useSheetPresence`.

  - New `OverlayShell` component — wraps `Modal` with `useModalRender` mount lifecycle and a11y props; accepts a render-prop child receiving `{ open, onExitComplete }` to drive `AnimatePresence`
  - New `useSheetPresence` hook — manages mount state and `translateY` shared value for slide-from-bottom sheets (extracted from `BottomSheet`)
  - `ActionFeedbackModal`, `FullSheet`, and `MorphingModal` now use `OverlayShell` internally

- 865d908: Add semantic color token system (`tokens.css`, `use-theme-color.ts`).

  - New `tokens.css` — Tailwind `@theme` block with `--color-*` CSS custom properties for light and dark modes (surface, foreground, primary, destructive, success, warning, etc.)
  - New `use-theme-color` hook — reads tokens from CSS custom properties on web (respects consumer `@theme` overrides) and from a static light/dark map on native
  - New `useThemeColors` convenience hook returning the full token map at once

- 425529d: Replace hardcoded hex colors with semantic theme token hooks.

  All components that previously used inline hex constants now read colors through `useThemeColor` / `useThemeColors`, enabling consumer `@theme` overrides to propagate into component internals on both web and native. Affected components: `ActionFeedbackModal`, `AnimatedBadge`, `AvailabilityScheduler`, `BloomMenu`, `BouncyAccordion`, `Button`, `Checkbox`, `FeedbackWidget`, `FullSheet`, `Input`, `Loader`, `MorphingModal`, `OtpInput`, `OverflowActions`, `Radio`, `ScrollProgress`, `StarRating`, `SwipeableList`, `Switch`, `Tabs`.

- 425529d: Add `pressTransition` and `labelClassName` props to `Button`.

  - `pressTransition` — partial override for the press-scale spring; defaults to `MOTION_SNAPPY`
  - `labelClassName` — additional NativeWind class names merged onto the label `Text`

- 425529d: Add `checkIcon` and `checkTransition` props to `Checkbox`.

  - `checkIcon` — replace the default SVG check/indeterminate mark with a custom node
  - `checkTransition` — partial override for the check-mark animation; defaults to `TIMING_FAST` (150 ms)

- 425529d: Add `closeIcon` and `errorIcon` slots to `FeedbackWidget`.

  - `closeIcon` — replace the default × icon in the panel header
  - `errorIcon` — replace the default `AlertCircle` icon shown in the error state

- b72f34a: Move `react-native-svg` to `peerDependencies`.

  As a native module it must be installed and autolinked by the consumer app; shipping it as a regular dependency risks duplicate autolink or version conflicts at the native layer — the classic RN library footgun.

  Consumers who relied on the transitive install will now need to add `react-native-svg` to their own `dependencies`.

- 425529d: Add `renderStar` custom render prop to `StarRating`.

  - `renderStar({ size, color, filled })` — replace the built-in `StarSvg` with any node; receives the resolved amber/muted color so consumers don't have to re-implement the color logic

- 425529d: Add `thumbTransition` prop to `Switch`.

  - `thumbTransition` — partial override for the thumb slide spring; defaults to `THUMB_SPRING` (stiffness 800, damping 80, mass 4)

- 425529d: Add `sortIcon` prop to `Table`.

  - New `sortIcon` prop on `HeaderCell` — replaces the default `ChevronUp` sort indicator with a custom node

- 5e6a72c: Restyle `Table` with NativeWind `className` and expose per-slot customization props.

  - Table internals now use Tailwind/uniwind `className` (merged via `cn`) instead of `StyleSheet` + the `useTableColors` hook. Colors resolve through the existing theme tokens (`bg-muted`, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-primary`, …) and are overridable with classes. Numeric values that can't be classes (column widths, row/container height, drop-indicator offset) stay inline.
  - New flat customization props on `Table`: `headerClassName`, `rowClassName`, `cellClassName`, `cardClassName`, `footerClassName` (the existing `className` covers the outer container). Each merges last-wins over the defaults — e.g. `rowClassName="bg-card"` overrides the row background. `style` / `cardStyle` / `stripedStyle` are retained for dynamic inline overrides.
  - Removed the `./table-styles` package export and deleted `table-styles.ts` and `table-theme.ts`. This drops a previously-published import path (`rn-motion-ui/table-styles`); migrate to the `className` / `*ClassName` props. Bumped as minor per maintainer decision.

- 425529d: Upgrade `cn` to a last-wins conflict resolver.

  Previously `cn` was additive-only (joined truthy strings). It now performs conflict resolution for all utility groups emitted by this library (layout, sizing, spacing, typography, color, border, etc.) — consumer `className` passed as the last argument always wins over component defaults, matching the behavior of `tailwind-merge` for the groups this library uses with zero added runtime dependencies.

### Patch Changes

- b72f34a: Add `./package.json` to the exports map.

  With a sealed `exports` map, tooling that resolves `rn-motion-ui/package.json` directly (Metro, Expo Doctor, some bundlers) would fail with a package-not-found error. The entry is a bare self-reference: `"./package.json": "./package.json"`.

  `check-exports.mjs` is updated to skip this key in both validation passes so it never reports it as a dangling or missing entry.

- 3afe9e5: Resolve the remaining Biome `info`-level diagnostics from `bun lint` (no runtime change).

  - **`useSortedClasses` (36)** across the Table components: let Biome sort the NativeWind `className` tokens into canonical order. Each reorder was verified safe against this repo's `cn` resolver — no string contained two tokens in the same conflict group, so the surviving class set is identical before and after (last-wins resolution is unchanged).
  - **`noAwaitInLoops` (2)** in `ActionFeedbackModal`'s `LoadingLoops` story `play`: suppressed with `biome-ignore` because both loops are intentionally sequential and time-dependent (polling for an animated dot to mount; sampling `translateY` 250 ms apart across theme re-renders). The rule's `Promise.all` suggestion would run the iterations concurrently and defeat the test's purpose.

- 5e6a72c: Fix `cn` conflict-resolution group collisions for `flex-*` and `border-*` utilities.

  - `flex-row`/`flex-col`/… (flex-direction) and `flex-1`/`flex-auto`/… (the flex shorthand) are different properties, so they now get separate groups. Previously they shared one `flex-direction` group, so `flex-row flex-1` collapsed and the direction utility was dropped.
  - Border-width patterns (`border-b`, `border-t`, `border-2`, …) are now matched before the border-color catch-all. The color regex matched the side letter in `border-b`, so `border-b border-border` previously collapsed both into the color group and the one-sided border _width_ was silently dropped.

- 0f03609: Satisfy the `check-no-hardcoded-colors` lint across `src/components` (no runtime change — comments only).

  - **Loader `Percent`**: the track-tint rationale comment mentioned `rgb(...)` / `rgb(…)26` in prose, which tripped the script's color-literal regex on lines that contain no actual color literal (the tint uses the `color` variable). Reworded to avoid the `rgb(` token rather than mislabel the line `theme-exempt`.
  - **SwipeableList `ICON_COLOR`**: the exported static map's `neutral`/`primary` entries (`#737373` / `#fafafa`, light-mode fallbacks for external consumers) are now annotated `/* theme-exempt */`. They can't call `useThemeColors()` (module-level constant) and are already resolved reactively in-component via `SwipeActionButton`, matching the existing `#ffffff` chromatic entries below.

- 7fa25e3: Fix manual light-mode override so it wins over an OS `prefers-color-scheme: dark` preference.

  The `@media (prefers-color-scheme: dark)` block in `tokens.css` previously targeted `:root` unconditionally, so selecting light (no `.dark` class) while the OS was dark still resolved to the dark tokens. The block is now gated on `:root:not(.light)`: a `.light` class (on `<html>` or any ancestor) opts out of the automatic OS-preference dark values and falls back to the `@theme` light defaults. `.dark` continues to force dark over an OS-light preference. Backward compatible — no existing selector loses behavior; `.light` is simply now a documented absolute override.

- 7fa25e3: Fix loaders (and other `useThemeColor` consumers) rendering transparent and not adapting to dark mode on web.

  Two bugs combined to keep loaders black in dark mode:

  1. **`useThemeColor`/`useThemeColors` went stale on a manual theme toggle.** On web the hooks read the active token via `getComputedStyle` during render, but only `useColorScheme()` drove re-renders — and that tracks the OS `prefers-color-scheme` media query, not a `.dark`/`.light` class swap on `<html>` (how the Storybook toolbar and most app toggles switch themes). So a class-toggle froze the resolved color at the last commit and it never refreshed. The hooks now also subscribe to the media query and to `class` mutations on `<html>`, re-rendering and re-reading the live CSS var on either signal.

  2. **oklch tokens were silently dropped.** `getComputedStyle` returns `@theme` token values verbatim as `oklch(...)`, but React Native's color parser (used by react-native-web for every color style and by react-native-svg) only knows hex/rgb/rgba/hsl/hsla/hwb/named colors and drops anything else — so `backgroundColor: useThemeColor('foreground')` rendered as no color at all (transparent), not black. oklch (and `oklab`/`color()`) values are now rasterised to an sRGB `rgb()`/`rgba()` string via a 1×1 canvas pixel, which RN and Reanimated both parse. Native (which already uses the sRGB static maps) and SSR are unchanged.

  The Loader stories no longer hardcode `color: '#111111'`, so each variant resolves from `useThemeColor('foreground')` and follows the theme toolbar (black in light, near-white in dark). The `Percent` track switched from a `${color}26` hex-alpha hack to a 15%-opacity sibling layer, since `color` is now `rgb(...)` and `rgb(…)26` is not a valid color.

- 7fa25e3: Fix the `dots` loader freezing after one cycle in `ActionFeedbackModal` (and anywhere it re-renders mid-loading).

  The dots bounce used moti's declarative `loop`, which rebuilds its `withRepeat(withTiming(target))` on every worklet re-run. The Dot re-renders whenever an ancestor `<AnimatePresence>` churns its presence context (a theme toggle, parent state change, etc.) — and `useContext` re-renders bypass `React.memo`. A rebuild that lands while the dot already sits at its `translateY` target leaves the repeat with zero forward distance, so the dot sticks at the top of the bounce permanently ("one cycle then stops"). Reproduced on both native and web.

  `Dot` now drives the bounce with a raw Reanimated shared value whose `withRepeat` is created **once** in a `useEffect` (deps: `reduce`/`size`/`speed`/`index`). Re-renders never cancel or rebuild the animation — the stored animation runs indefinitely regardless of ancestor re-renders. The opacity fade-in is a one-shot `withTiming`; under reduced-motion the dot stays put and opacity gently pulses instead of bouncing.

- 5e6a72c: Fix `StarRating` rolling value label shoving the `/max` label sideways on change.

  The animated value digit was rendered inline next to `/max`, so the entering and exiting digits sat side-by-side and shifted the `/max` label on every change. The slot now reserves the digit's width with a hidden sizer and absolutely positions the animated label so the two digits overlap during the transition instead of pushing neighbors. Mirrors the `TextRolling` layout.

- 7fa25e3: Fix `StatefulButton` and `ActionFeedbackModal` success/error glyphs vanishing in dark mode.

  Both used the `surface` token for the success/error label (`StatefulButton`) and the morph `Check`/`X` glyphs (`ActionFeedbackModal`). `surface` is near-white in light mode but near-black (`#111111`) in dark mode, so against the saturated green/red success/error backdrop the text and icons were illegible in dark mode. Switched to theme-exempt white (`#ffffff`) so the glyphs read against the fill in both themes, matching the existing convention in `SwipeableList`.

- 7fa25e3: Fix web theme colours being silently dropped because they resolved to oklch.

  `useThemeColor`/`useThemeColors` read `@theme` tokens via `getComputedStyle`, which returns the authored `oklch(...)` strings. Reanimated's colour interpolator and react-native-web's inline-style colour parser only understand sRGB (hex/rgb/rgba/hsl), so animated and inline theme colours were dropped — leaving e.g. the ActionFeedbackModal morph vessel transparent (white glyph invisible against the card) and Loader dots colourless on web. The hooks now resolve oklch (and other non-sRGB CSS colours) to sRGB on web via a 1×1 canvas pixel readback, matching native's static sRGB maps. Native is unaffected.

- b72f34a: Close reduced-motion gaps in animated components.

  Six component directories never called `useReducedMotion` despite driving visible animations. All are now fixed:

  - **`use-sheet-presence`** — new `reducedMotion` option; swaps `withSpring` → `withTiming(160 ms)` for both open and close.
  - **`BottomSheet`** — reads `useReducedMotion()` and passes it to `useSheetPresence`.
  - **`FullSheet`** — replaced the inline `AccessibilityInfo` + `useState` + `useEffect` re-implementation with the shared `useReducedMotion` hook.
  - **`ActionFeedbackModal`** — `reduced` propagates into `MorphIcon` (all four morph transitions) and into the backdrop/card enter/exit transitions.
  - **`AdaptiveDropdown`** — `reduced` drives the panel enter spring (→ timing) and exit duration/easing.
  - **`AnimatedList`** — all `withTiming` calls in `AnimatedListItem` switch to 80 ms linear on reduced-motion; `reduced` added to both dependency arrays.
  - **`MultiStepMenu`** — slide and arrow transitions computed from `useReducedMotion()` rather than file-level constants.

  `Card` and `CardChoice` are static (no animation imports) and were excluded. `TextCascade` inherits coverage via `ActionSwap`.

- 5e6a72c: Fix `SwipeableList` action-icon contrast in dark mode for `neutral`/`primary` tones.

  `neutral` and `primary` action badges use theme-inverting backgrounds (`bg-muted`/`bg-primary`), but their icon colours were hardcoded hex (`#fafafa`/`#71717a`), so icons went invisible or low-contrast when the theme flipped. The render path now resolves these icon colours reactively via `useThemeColors()` (`muted-foreground`/`primary-foreground`), overriding any colour baked into the passed icon node so the stroke stays legible against the badge. Chromatic tones (`success`/`warning`/`danger`) keep white icons — their vivid backgrounds are stable across themes. The exported `SWIPE_TONE_ICON_COLOR` static map is now documented as a light-mode fallback for icons rendered outside the component.

## 2.2.0

### Minor Changes

- 4f9f467: **Breaking**: remove `NotFoundStacked` and `NotFoundTerminal`; unexport `InputType`.

  - `NotFoundStacked` and `NotFoundTerminal` are removed from the `not-found` export — use `NotFoundGlitch` instead.
  - `InputType` is no longer re-exported from `input`; it is an internal type.

- 4f9f467: Table overhaul: pagination, load-more, infinite scroll, striped rows, sortable master switch, `getSortValue`, rich empty state. New `hasKey<K>` worklet typeguard.

  **Table:**

  - New `mode` prop (`'loadMore' | 'pagination' | 'infiniteScroll'`) controls the footer pattern.
  - Pagination: `page`, `pageSize`, `total`, `onPageChange`, `paginationLabel` props; `PaginationFooter` rendered outside `FlatList` so it stays pinned.
  - `loadingMore` prop shows a spinner + skeleton footer while a follow-up page is fetching.
  - `striped` / `stripedStyle` props for alternating-row shading.
  - `sortable` master switch — set to `false` to disable sort on all columns regardless of per-column flags.
  - `TableColumn.getSortValue` — custom value extractor used during client-side sort; avoids sorting on rendered React nodes.
  - `TableColumn.skeletonWidth` — configure the skeleton bar width per column.
  - Rich empty state: `emptyIcon`, `emptyTitle`, `emptyDescription` props (used when `emptyState` is not provided).
  - `onLoadMore` / `loadMoreLabel` for `loadMore` mode.
  - `onEndReached` now only fires in `infiniteScroll` mode — prevents accidental triggers in other modes.
  - `TableMode` type is now exported from the `table` entry point.
  - `table-parts` entry: `TableCard`, `SkeletonFooter`, `PaginationFooter`, `LoadMoreFooter` extracted into their own file.

  **Utils:**

  - `hasKey<K>(obj, key)` typeguard added to `utils/typeguards` — annotated `'worklet'` for Reanimated UI thread use.

### Patch Changes

- 4f9f467: Internal housekeeping — no API changes.

  - `Switch`: move `TRAVEL` / `SWITCH_SHAKE_STEPS` constants before the `SwitchProps` type declaration (forward-reference cleanup).
  - `ActionSwap`: remove unused `cn` import.

## 2.1.0

### Minor Changes

- cb83916: Add `className`/`style` support to all components; extend Button variants; port Input improvements from offkeep

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

## 2.0.0

### Major Changes

- ecaccd5: feat(stateful-button)!: built-in async state machine driven by `onPress`

  **StatefulButton** (breaking)

  - `onPress` is now `() => Promise<void>` and drives a built-in machine: pressing runs idle → loading → success (or error, if the promise rejects) without the consumer managing `state`.
  - New timing props: `minLoadingMs` (default 300) keeps the loader visible long enough to not flash; `successDurationMs` (default 850) and `errorDurationMs` (default 600) set how long the terminal state is shown.
  - New callbacks: `afterSuccess()` and `afterError(error)` fire once the respective display window ends — use them for navigation, closing a sheet, toasts, etc.
  - New `autoReset` prop (default `false`): by default the button holds its terminal state **disabled** after the window ends (safe for page transitions that unmount it — no double-fires); set `autoReset` to return to idle and re-enable instead.
  - Controlled mode is unchanged: passing an explicit `state` bypasses the machine entirely (timings, `afterSuccess`/`afterError` and `autoReset` are ignored), and `onPress` fires as a plain handler.
  - Migration: consumers that previously drove `state` with their own timers can delete that plumbing and return a promise from `onPress`; consumers that keep `state` only need to make `onPress` async.

### Minor Changes

- ab36acd: feat(button): add `shape`, `noDisabledOpacity`, `backdropColor`, and `contentStyle` props

  - `shape` controls the border radius: `'rounded'` (default, `rounded-xl`) or `'pill'` (`rounded-full`). Previously all sizes hard-coded `rounded-full`.
  - `noDisabledOpacity` skips the 0.5 opacity when `disabled`, for cases where a button is disabled for interaction reasons but should remain visually prominent (e.g. success/error hold in StatefulButton).
  - `backdropColor` animates an absolutely-positioned colour overlay in/out by opacity without touching the variant background — used by StatefulButton for its success/error state fill.
  - `contentStyle` applies extra inline style to the Pressable container for layout overrides that cva class strings control.

- b57ff3c: fix(checkbox): animate fill with MotiView; remove(file-upload): delete FileUpload component

  **Checkbox**

  - Checkbox fill is now animated via `MotiView`, replacing the previous static fill implementation.

  **FileUpload** (removed)

  - `FileUpload` component and its Storybook story have been deleted.
  - Removed from the component list in `README.md` and `packages/ui/README.md`.

- df6ce72: **WheelPicker**: add `variant` prop (`'border' | 'filled'`, default `'filled'`) — the outer container is now a `Card`, so the picker inherits all card variants. Also fixes cylinder rendering: radius now uses the `tan` formula (rows tangent to the drum circle) instead of `sin`, and row transforms switch from `rotateX + perspective + scale` to `translateY + scaleY` — uniform perspective per element was wrong, `scaleY` alone converges all rows to the correct horizon line. Selection pill hairline borders removed; decorative centre drum marked `aria-hidden`.

  **Card**: `ref` is now part of `CardProps` (`ref?: Ref<View>`). React 19 passes `ref` as a plain prop through `...props`, so forwarding works without `forwardRef`.

- c966432: feat(wheel-picker): add `sound` prop; steepen row opacity falloff

  - New `sound` prop (default `false`): plays a short sine-wave tick on web (Web Audio API, lazily created to satisfy browser autoplay policy) or a brief `Vibration` pulse on Android on each row crossing while dragging.
  - Opacity curve changed from `cos θ` to `cos² θ` for a steeper falloff — edge rows now read more clearly as sitting behind the drum wall.

### Patch Changes

- 0a456d5: fix: update Card, NotFound, OtpInput, and WheelPicker selection pill to rounded-2xl

  Aligns rounding with the Button default `rounded` shape (`rounded-xl`) across the component suite. Affected: `Card`, `NotFoundTerminal` container, `OtpInput` slot, `WheelPicker` selection pill.

- c6b4e91: fix(table): use `alignItems` for SkeletonCellPulse cell alignment

  `justifyContent` acts on the main axis — in the column-direction cell `View`, that's vertical. `alignItems` is the correct prop for horizontal (cross-axis) alignment of the skeleton pulse within its column slot.

- 2374962: fix(tabs): skip indicator mount animation when starting on a non-first tab

  The sliding indicator previously always animated from its MotiView initial position on first render, producing a slide-in flash when `defaultValue` or a controlled `value` pointed to a tab that wasn't the first. A `hasPositioned` ref now lets the indicator jump directly to its initial slot and only enables the spring after the first layout commit.

## 1.1.0

### Minor Changes

- 83b611b: feat(star-rating): new animated StarRating component; fix(range-slider): no spring on mount, hide thumb until layout; perf(table): skip sort allocation when already sorted

  **StarRating** (new component — `@rn-motion-ui/ui/star-rating`)

  - Animated star-rating input: tapping a star commits the rating with a squash-and-stretch pop and an amber sparkle burst; tapping the committed star clears it (`allowClear`, default `true`).
  - Works controlled (`value` prop) or uncontrolled (`defaultValue`).
  - Supports fractional read-only display (e.g. 4.3 stars) via `readOnly`.
  - Optional rolling value label (`showValue`) animates up/down as the value changes.
  - Three sizes: `sm`, `md` (default), `lg`.
  - Full accessibility: `radiogroup` / `radio` ARIA roles, `increment` / `decrement` actions.
  - Honours `prefers-reduced-motion` — all animations collapse to instant.
  - Storybook story included.

  **RangeSlider**

  - `smooth` shared value is now initialised to the current ratio so there is no spring animation on first render.
  - Thumb is hidden (`opacity: 0`) until `onLayout` fires, preventing a flash at `x=0` on mount.
  - Replaced `useDerivedValue` with `useSharedValue` + `useEffect` to keep the smooth value in sync with externally-controlled `ratio` changes.

  **Table utilities**

  - `sortRows` checks whether `rows` is already in sorted order before allocating a new array; returns the same reference when no sort is needed, avoiding a `FlatList` reconciliation pass on every render.
  - Extracted `compareValues` helper to eliminate duplicated null / number / string comparison logic.

- a41c556: Table: add small-screen card view; Checkbox: animate fill with MotiView

  **Table**

  - New `renderSmallScreen` prop: a render function `(row, selected) => ReactNode` that replaces the column layout with a custom card per row.
  - New `useSmallScreen` boolean prop: when `true` (and `renderSmallScreen` is provided), switches the table into card mode — the sticky header is hidden and each row is rendered via `renderSmallScreen` inside a `Pressable` card.
  - New `cardStyle` prop: optional style applied to each card container in card mode.
  - Card mode provides its own skeleton loading state (three placeholder lines per card) and skips `getItemLayout` so variable-height cards scroll correctly.
  - New `SmallScreen` story with a toggle to switch between table and card views.

  **Checkbox**

  - Replaced the `cva`-based box colour swap with a `MotiView` animated fill overlay. The primary fill now fades in and out at 160 ms (or instantly when `reduce` is on) instead of switching via class variants, matching the mark animation timing.
  - Removed the unused `cva` import.

## 1.0.0

### Major Changes

- 17c2ce8: Remove `PredictionMarket` component

  The `PredictionMarket` component and its `./prediction-market` subpath export have been removed from the package. Consumers importing from `rn-motion-ui/prediction-market` must remove those imports.

### Patch Changes

- 17c2ce8: Fix animation correctness and loading indicators

  - **AnimatePresence**: exiting items now stay at their original list position instead of being appended at the end (insertion-order tracking via `keyOrderRef`).
  - **AnimatedList**: exit animation gains a downward `translateY: 8` drop alongside the existing fade+scale.
  - **Loader**: dots bounce now uses `EASE_IN_OUT` easing for a smoother feel.
  - **Button**: `buttonContent` rendered before ripples so it sits above them in z-order; `pointerEvents="none"` moved from `style` to a MotiView prop on each ripple.
  - **StatefulButton**: replaces the SVG spinning ring with a three-dot `DotsLoader`; button width is held stable during loading by keeping the idle text as a hidden sizer.
  - **ActionFeedbackModal**: loading state now uses `<Loader variant="dots">`.

## 0.2.0

### Minor Changes

- 0e9215d: Add five new components — `AdaptiveModal`, `AnimatedList`, `Card`, `CardChoice`, and `Skeleton` (each with stories and package exports) — and refine existing ones:

  - `ActionFeedbackModal`: rewrite the status icon as a single morphing vessel that animates size + fill colour across loading/success/error states while the glyph cross-fades, replacing the three static icon variants.
  - `CommandPalette`: rework layout and interaction handling.
  - `MultiStepMenu`: refine component and stories.

## 0.1.0

### Minor Changes

- First public release of `rn-motion-ui` as a single package. Consolidates the former `@rn-motion-ui/{rn,moti,hooks,utils}` packages into one unscoped package with subpath exports (no barrel files): 40+ animated React Native / React Native Web UI components, the Moti/Reanimated 4 primitives, shared React hooks, and shared TypeScript utilities.
