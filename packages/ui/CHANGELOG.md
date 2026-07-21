# rn-motion-ui

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
