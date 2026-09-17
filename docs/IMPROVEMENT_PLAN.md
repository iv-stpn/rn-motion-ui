# rn-motion-ui — Improvement Plan

**Scope:** UX · UI consistency · codebase health (5 packages, ~93k lines)
**Source of truth:** Repowise index at live HEAD (`c97f814b`) + repo memory + file-level research
**Last generated:** 2026-09-17

This supersedes the earlier code-health-only plan. It keeps that plan's still-open work, marks what is already done, and adds two pillars that the old plan did not cover: **UX/accessibility** and **UI/design-token consistency**.

---

## 0. Current state (fresh numbers)

| Signal | Value | Reading |
|---|---|---|
| Average code health | **6.4 / 10** | `warning` band |
| Hotspot health | **5.12 / 10** | stable, below target |
| Maintainability | 9.27 / 10 | healthy |
| Performance | 9.98 / 10 | 15 findings, all in build scripts (`health_impact: 0`) |
| Dead code | **10 safe-to-delete exports, 319 lines** | down from the old plan's "29 / 414" |
| Import cycles | repowise says 6 · `madge --circular` says **0** | tooling disagreement — see Pillar 3 |

Health distribution by NLOC: **27.6% healthy · 57.2% warning · 15.1% alert** (38 alert files, ~11.2k lines). The dominant open signal is **`untested_hotspot`** — high-churn, high-dependency files with no behavioral guard.

### Status of the prior plan's phases

| Phase | Status |
|---|---|
| 0 — Exclude non-code from scoring | **Open** — `CHANGELOG.md` is still the #1 "high-leverage" file (7.1% of gap) |
| 1 — Test the untested hotspots | **Open** — the highest-ROI remaining work |
| 2 — Decomplex CCN hotspots | Done / not actionable (high `max_ccn` is intentional derived-state lifecycle code) |
| 3 — Split change-entropy / bug-magnet files | Done / well-factored |
| 4 — Dead-code removal | **Partially done** — 10 exports / 319 lines remain (list in Pillar 3) |
| 5 — Break import cycles | Done in live code (`madge` = 0) |
| 6 — Harden recurring defect patterns | Partially done (documented in memory; some lack lint/scripts) |
| 7 — Script-only performance | Deferred (no runtime impact) |

---

## Pillar 1 — UX & accessibility

### 1.1 Input parity: touch-only primitives (mouse broken on web)

The `Holdable` and `Draggable` primitives default to **touch-only**. A mouse left-click/hold does nothing unless the consumer passes `cursorMode`.

- [use-holdable-pointer.ts:52-57](packages/ui/src/components/gestures/Holdable/use-holdable-pointer.ts#L52-L57) — `acceptsPointer` returns true only for `pointerType === 'touch'`; mouse needs `cursorMode && button === 0`.
- [use-holdable.ts:163](packages/ui/src/components/gestures/Holdable/use-holdable.ts#L163) — `cursorMode = false` by default; doc `:94-96` says "Touch only, on every platform".
- [use-draggable-pointer.ts:74-79](packages/ui/src/components/gestures/Draggable/use-draggable-pointer.ts#L74-L79) — same filter; `hold-draggable.tsx:74` defaults `cursorMode = false`.
- Native transport is `Gesture.Pan()` wired only to touch events ([use-holdable-touches.ts:69-121](packages/ui/src/components/gestures/Holdable/use-holdable-touches.ts#L69-L121)).

**Correction to prior belief:** `HoldMenu` itself is *not* mouse-broken on web — [hold-item.tsx:306-319](packages/ui/src/components/menus/HoldMenu/hold-item.tsx#L306-L319) wires native `contextmenu` (right-click) for `'hold'` and `onClick` for `'tap'`, and `contextmenu` also fires for Shift+F10 / the ContextMenu key. Only the *touch-hold path* ([hold-item.tsx:272-278](packages/ui/src/components/menus/HoldMenu/hold-item.tsx#L272-L278)) is touch-only.

**Actions**
1. Decide the intended web contract: for `Holdable`/`Draggable` on web, either default `cursorMode` on when a mouse is present, or expose it clearly and update every internal consumer that renders on web.
2. Add a story-play guard that drives a mouse hold (`pointerType: 'mouse'`) and asserts the hold fires, so this parity gap can't regress silently.

**Done when:** a mouse hold on web fires the same `hold`/drag callback as a touch hold for the primitives, covered by a play test.

### 1.2 Accessibility roles / labels / states

Mostly strong (Button/IconButton/CloseButton, Checkbox, Radio, Switch, RangeSlider, StarRating, Menu rows all carry roles + aria). Gaps:

- [hold-item.tsx:321-329](packages/ui/src/components/menus/HoldMenu/hold-item.tsx#L321-L329) — the `HoldItem` trigger is a focusable `Animated.View` (`tabIndex: 0`) with **no `accessibilityRole`, `accessibilityLabel`, `aria-haspopup`, or `aria-expanded`**. A focusable menu trigger that is invisible and unlabeled to screen readers.
- [menu.tsx:62](packages/ui/src/components/menus/HoldMenu/menu.tsx#L62) + [menu-list.tsx:178-187](packages/ui/src/components/menus/HoldMenu/menu-list.tsx#L178-L187) — the `HoldMenu` panel has no `role="menu"` / accessible name; it isn't announced on open.
- [tabs.tsx:427-456](packages/ui/src/components/navigation/Tabs/tabs.tsx#L427-L456) — `TabsList` carries no `role="tablist"` / `aria-orientation` / `aria-controls` (the triggers themselves do have `role="tab"` + `aria-selected`, `:479-480`).

**Actions:** add `accessibilityRole="button"` (or `menu`) + `accessibilityLabel` + `aria-haspopup`/`aria-expanded` to `HoldItem`; add `role="menu"` + an accessible name to the `HoldMenu` panel; add `role="tablist"` + `aria-orientation` to `TabsList`.

**Done when:** a screen-reader sweep of the above triggers announces "button, [label], popup" / "tablist" and open state, without needing the demo app.

### 1.3 Keyboard navigation

- [tabs.tsx:458-496](packages/ui/src/components/navigation/Tabs/tabs.tsx#L458-L496) — no `onKeyDown`/roving tabindex; ArrowLeft/Right do not move selection (only Tab + Enter/Space via RNW).
- [radio.tsx:167-193](packages/ui/src/components/form/Radio/radio.tsx#L167-L193) and [checkbox.tsx:174-198](packages/ui/src/components/form/Checkbox/checkbox.tsx#L174-L198) — no arrow-key navigation within groups on web.
- [command-palette.tsx:182](packages/ui/src/components/menus/CommandPalette/command-palette.tsx#L182) — the `active` highlight is driven only by `onPressIn`; no ArrowUp/Down/Enter, so keyboard users can type but can't move through or select results.
- **No `:focus-visible` styling anywhere** in `packages/ui/src/components` — controls get hover classes (e.g. `BUTTON_HOVER_CLASS`) but no keyboard focus ring on web; the only focus affordance is Tabs' text-color highlight ([tabs.tsx:462-475](packages/ui/src/components/navigation/Tabs/tabs.tsx#L462-L475)).

*Already good:* `rows/menu.tsx:498` + `use-menu-keyboard.ts` (ArrowUp/Down + Home/End roving), `wheel-picker.tsx:626-648` (arrow/Home/End), `hover-menu.tsx:225-240` (Escape/outside/focusout close).

**Actions**
1. Add a reusable `focus-visible` ring utility and apply it to Button/IconButton/Menu rows/Tabs — the web equivalent of the existing hover classes.
2. Add arrow-key roving to `Tabs` (left/right) and to `Radio`/`Checkbox` groups (up/down within group).
3. Give `CommandPalette` real keyboard selection (ArrowUp/Down moves `active`, Enter commits), mirroring the existing `use-menu-keyboard` pattern.

**Done when:** each interactive component is reachable and operable by keyboard alone, with a visible focus indicator, on web.

### 1.4 Hit targets (< ~44px)

- [switch.tsx:41-62](packages/ui/src/components/form/Switch/switch.tsx#L41-L62) — track is `h-4/5/7` (16/20/28px); the `Pressable` (`:334-343`) wraps only the track with no `hitSlop` → 16–28px target.
- [checkbox.tsx:100](packages/ui/src/components/form/Checkbox/checkbox.tsx#L100) — box is `h-5 w-5` (20px), `Pressable` (`:174`) adds no padding → 20px target when `label` is absent.
- [radio.tsx:141](packages/ui/src/components/form/Radio/radio.tsx#L141) — same 20px pattern.
- `IconButton`/Button `xs`/`sm` — `INTERACTIVE_HEIGHT` starts at 24/36px ([radius.ts:41](packages/ui/src/lib/radius.ts#L41)).
- [star-rating.tsx:99-120](packages/ui/src/components/form/StarRating/star-rating.tsx#L99-L120) — star `Pressable` pad `p-1` + 16/22/28 icon → 24/30/36px targets.

**Actions:** add `hitSlop` (or a min 44px touch area) to Switch, Checkbox, Radio, StarRating, and the `xs`/`sm` Button/IconButton sizes — without changing their visual footprint.

**Done when:** every interactive control has an effective ≥44px touch target (verify by measuring the DOM in a story play, per the `verify-visuals-by-measuring-dom` convention).

### 1.5 Feedback & announcements

- [toaster.native.tsx:72-74](packages/ui/src/components/display/Toaster/toaster.native.tsx#L72-L74) — toast pill uses `accessibilityLiveRegion="polite"` but **not `assertive`/`role="alert"`** for errors; the whole-pill dismiss `Pressable` has no role/label. (Web `Toaster` delegates to Sonner, which supplies its own live region — acceptable.)
- Elsewhere strong: `action-feedback-modal.tsx:186-255` (polite/assertive + `aria-live` + `announceForAccessibility`), `dynamic-island.tsx:110`, `stateful-button.tsx:651-652`, `input.tsx:120` (`role="alert"`), `otp-input.tsx:502`.

**Action:** make native error toasts `assertive` (or `role="alert"`), and give the dismiss control a `role="button"` + label.

### 1.6 Reduced motion (one small gap)

Reduced motion is broadly gated — [use-reduced-motion.ts:10-27](packages/ui/src/hooks/use-reduced-motion.ts#L10-L27) uses `AccessibilityInfo.isReduceMotionEnabled()` + `reduceMotionChanged`, and ~60 components import it; RNW backs it with `matchMedia('(prefers-reduced-motion: reduce)')`.

**Gap:** `use-reduced-motion.ts:11` initializes `useState(false)` and resolves asynchronously, so the **first paint can animate** before the preference resolves.

**Action:** start reduced-motion in a "defer until resolved" state (e.g. treat `false` as "not yet known", skip the entrance animation on first mount until the async check returns), or read a synchronous native/web flag first.

### 1.7 Overlay/Blur quirks (confirmed)

- **BlurView needs a `BlurProvider` on Android** — [overlay-blur.native.tsx:9-13](packages/ui/src/components/menus/Overlay/overlay-blur.native.tsx#L9-L13); without it the scrim degrades to a plain translucent dim ([blur-provider.native.tsx:70-102](packages/ui/src/components/menus/Overlay/blur-provider.native.tsx#L70-L102)).
- **Hardcoded `zIndex: 10`** on the peer's `BlurView` wrapper ([surface.native.tsx:198-203](packages/ui/src/components/display/Surface/surface.native.tsx#L198-L203)) lifts the frost above sibling content and "frosts them away" on iOS; `Surface` works around it by flattening to `zIndex: 0`. Any direct `BlurView` consumer that doesn't flatten this will have its Rim/children disappear under the frost.
- **Inline `BlurView` inside its own `BlurTarget`** cycles the Android RenderNode graph (SIGSEGV) — [overlay-blur.native.tsx:85-98](packages/ui/src/components/menus/Overlay/overlay-blur.native.tsx#L85-L98); `HoldMenu` avoids it by teleporting its backdrop outside the target ([provider.tsx:151,253](packages/ui/src/components/menus/HoldMenu/provider.tsx#L151)).

**Actions:** document these three constraints in a single "blur" section of the component docs so future overlay consumers don't re-discover them; consider lifting the `zIndex: 0` workaround into a shared helper.

---

## Pillar 2 — UI consistency (design tokens)

### Token map (canonical sources)

| Layer | Source |
|---|---|
| CSS tokens + `@utility` | [tokens.css](packages/ui/src/theme/tokens.css) — colors (surface ladder, brand, status, glass), shadows, spacing, radius, typography, `hairline*`, `input-vcenter` |
| Native/SSR color tables + hooks | [use-theme-color.ts](packages/ui/src/theme/use-theme-color.ts) — `ThemeToken`, `LIGHT_OKLCH`/`DARK_OKLCH`, `useThemeColor(s)` |
| Radius + interactive geometry | [radius.ts](packages/ui/src/lib/radius.ts) — `INTERACTIVE_RADIUS` 8 / `CARD_RADIUS` 24 / `MENU_RADIUS` 16 / `MODAL_RADIUS` 32, `H_INTERACTIVE`/`PX_INTERACTIVE` |
| Surface / elevation | [surface.ts](packages/ui/src/lib/surface.ts), [elevated.ts](packages/ui/src/lib/elevated.ts) — `SurfaceLevel` 1–3, `SurfaceElevation` 0–3, `elevated()`/`surfaceBackground()` |
| Motion | [motion.ts](packages/ui/src/theme/motion.ts) — durations, springs, menu motion |

### 2.1 Elevation: one component off the ladder, several parallel shadow recipes

The simplified model is **3 levels + flat** (`elevated.ts`), and no component uses the old granular levels 4–9. But raw shadows survive outside it:

- [switch.tsx:214-217](packages/ui/src/components/form/Switch/switch.tsx#L214-L217) — the **only** component left on the raw RN shadow path (`elevation: 3`, `shadowColor:'#000'`, `shadowOpacity/Radius`, `boxShadow`). Move it to `elevated(1)` / `shadow-elevated-1`.
- [button.tsx:48-51](packages/ui/src/components/buttons/Button/button.tsx#L48-L51) — `FILLED_SHADOW_DROP` raw `rgba(27,28,29,…)` drops (a second recipe for filled variants).
- [elevated-button.tsx:134-137,183-196](packages/ui/src/components/buttons/Button/elevated-button.tsx#L134-L137) — `GRAY_FILL`/`GRAY_LABEL`/`GRAY_SHADOW` hex/rgb + a local Geist `shadow-fancy-buttons-*` recipe.
- [picker-thumb.tsx:33](packages/ui/src/components/form/ColorPicker/picker-thumb.tsx#L33) — raw `boxShadow: '0 1px 2px rgba(0,0,0,0.3)'`.
- [file-system-mobile-grid-view.tsx:68](packages/ui/src/components/file-system/FileSystem/views/file-system-mobile-grid-view.tsx#L68) / [file-system-mobile-list-view.tsx:185](packages/ui/src/components/file-system/FileSystem/views/file-system-mobile-list-view.tsx#L185) — Tailwind `shadow-lg` instead of `shadow-elevated-N`.
- [menu-item.tsx:237](packages/ui/src/components/rows/menu-item.tsx#L237) — arbitrary `shadow-[0_0_2px_0.5px_rgb(0_0_0_/_0.20)]`.

**Actions:** route the Switch thumb through `elevated()`; for the Button/`elevated-button` recipes, either fold them into the token ladder as explicit variants or leave them with a documented reason — but stop treating them as invisible.

### 2.2 The color guard can't see most of this

[check-no-hardcoded-colors.mjs](packages/ui/scripts/check-no-hardcoded-colors.mjs) only walks `src/components` (line 26), only flags `#hex`/`rgb(`/`rgba(` (line 48), skips comments (52), and **unconditionally exempts any line containing `shadowColor`/`boxShadow`** (31-32) plus a hardcoded allowlist (scrims, neon, `#6366f1`). Consequences:

- It never checks `lib/`, `theme/`, `hooks/`, `moti/` — so token drift there is invisible.
- It never checks raw px spacing or border widths at all.
- The `shadowColor`/`boxShadow` blanket exemption lets the raw shadows in §2.1 through even inside `components`.

**Actions**
1. Remove the blanket `shadowColor`/`boxShadow` exemption — require shadows to come from the token ladder (with an explicit per-line opt-out comment for the two intentional Button recipes).
2. Extend the scan to `lib/` and `theme/` (or at least `lib/`).
3. Add px-spacing and border-width checks (see §2.3, §2.4).

### 2.3 Hairline is 2px — mirrored JS constants are now stale

The `hairline` utility is **2px**, not 2.5px (settled in `7f7bc3af`, defined at [tokens.css:282-301](packages/ui/src/theme/tokens.css#L282-L301)). Repo memory still says 2.5px — out of date.

**Bug — the JS constants that mirror the width did not move with it** (the documented convention is that they "must move with it"; the tests won't catch this because they import the same constants):

- [menu-placement.ts:270-272](packages/ui/src/components/rows/menu-placement.ts#L270-L272) — `HOLD_MENU_SEGMENTED_SEAM_HEIGHT = 2.5` (should be **2**) and `HOLD_MENU_BORDER_HEIGHT = 5` (should be **4** = top + bottom). These feed the HoldMenu panel-height math, so the panel over-counts by 1px and each segmented seam by 0.5px.
- [dock.tsx:35](packages/ui/src/components/navigation/Dock/dock.tsx#L35) — `BORDER_WIDTH = 2.5` (should be **2**), skewing the Dock inset by 0.5px.

**Deliberate, not a bug:** the *selected* border of `RadioCard`/`CheckboxCard` is `border-[3px]` ([radio-card.tsx:120](packages/ui/src/components/form/RadioCard/radio-card.tsx#L120), [checkbox-card.tsx:63](packages/ui/src/components/form/CheckboxCard/checkbox-card.tsx#L63)) — a second weight so selection reads stronger than the resting hairline. Keep it. Only the stale comment at [checkbox-card.tsx:465](packages/ui/src/components/form/CheckboxCard/checkbox-card.tsx#L465) ("hairline + 0.5px", written for the old 2.5px) needs updating — it is now "hairline + 1px".

**Still a stray:** [picker-thumb.tsx:31](packages/ui/src/components/form/ColorPicker/picker-thumb.tsx#L31) uses raw `borderWidth: 2` (now coincidentally equal to hairline) instead of the `hairline` utility — switch it for consistency.

*(ButtonGroup correctly uses `hairline-r`/`hairline-b` + `border-l-0`/`border-t-0`; Radio/Checkbox/Input use `hairline` + `border-*` color classes — the intended pattern.)*

**Actions:** fix the three stale constants to 2 / 4 / 2, update the stale `checkbox-card.tsx:465` comment, switch `picker-thumb` to `hairline`, and add a `hairline`-vs-bare-`border` check to the guard script.

### 2.4 Radius tokens exist but components hardcode `rounded-*`

Token values: `rounded-interactive` 8 / `rounded-card` 24 / `rounded-menu` 16 / `rounded-modal` 32. Strays:

- [menu-item.tsx:76](packages/ui/src/components/rows/menu-item.tsx#L76) — `ROUNDED_VARIANT = { sm:'rounded', md:'rounded-md', lg:'rounded-lg' }` (raw 4/6/8px) instead of `rounded-interactive`.
- [radio-card.tsx:499,519](packages/ui/src/components/form/RadioCard/radio-card.tsx#L499) / [checkbox-card.tsx:460,469](packages/ui/src/components/form/CheckboxCard/checkbox-card.tsx#L460) — `rounded-2xl` (16px = the *menu* value) on a card, bypassing `rounded-card` (24px). Documented as deliberate in [surface.ts:13-15](packages/ui/src/lib/surface.ts#L13-L15), but "cards render at menu radius" is a real semantic divergence.
- [swipeable-list.tsx:521,539,572](packages/ui/src/components/display/SwipeableList/swipeable-list.tsx#L521) — `rounded-2xl` instead of a card/menu token.
- [color-picker.tsx:18,46,60](packages/ui/src/components/form/ColorPicker/color-picker.tsx#L18) — `rounded-[6px]`, `rounded-[5px]`, `rounded-lg`.
- [command-palette.tsx:142](packages/ui/src/components/menus/CommandPalette/command-palette.tsx#L142) — `rounded-md`.
- [file-system-mobile-grid-view.tsx:68](packages/ui/src/components/file-system/FileSystem/views/file-system-mobile-grid-view.tsx#L68) — `rounded-lg bg-surface-3 shadow-lg` (raw radius + raw shadow together).

**Actions:** adopt the radius tokens in these spots; where `rounded-2xl` on cards is truly intentional, promote it to a named token (`--radius-card-compact`) rather than a raw class.

### 2.5 Spacing literals

- [radio.tsx:178](packages/ui/src/components/form/Radio/radio.tsx#L178) / [checkbox.tsx:184](packages/ui/src/components/form/Checkbox/checkbox.tsx#L184) — `gap: 12` in a style object.
- [multi-step-menu.tsx:350](packages/ui/src/components/menus/MultiStepMenu/multi-step-menu.tsx#L350) — `width: 32, paddingRight: 8`.

**Action:** fold into the spacing tokens / `--spacing-interactive-*`; add a px-spacing check to the guard script once the token set covers these.

### 2.6 Dark-mode parity guard only covers `--color-*`

Dark mode is fully migrated to `@variant light`/`@variant dark` (no `.media`/`.dark`/`@media` blocks remain). But [check-token-parity.mjs:46](packages/ui/scripts/check-token-parity.mjs#L46) matches only `--color-*`, so the shadow/rim/hi/ring tokens (`--shadow-surface-*`, `--surface-rim-*`, `--surface-hi-*`, `--surface-ring-*`) are **not parity-checked** — a drift between light/dark would not fail the build. `--shadow-elevated-N` is defined only in `@theme` and relies on uniwind resolving its `var(--surface-rim-N)`/`var(--shadow-surface-N)` chain per-theme ([tokens.css:216-218](packages/ui/src/theme/tokens.css#L216-L218)) — the single unenforced trust point for dark-mode elevation.

**Action:** widen `check-token-parity.mjs` to include the `--shadow-*`/`--surface-*`/`--radius-*`/`--spacing-*` tokens so light/dark drift is caught in CI.

---

## Pillar 3 — Codebase health & architecture

### 3.1 Test the untested hotspots (highest ROI, from the prior plan — still open)

The `untested_hotspot` biomarker means "no paired `__tests__` file and no coverage." Not every flag is truly untested — this repo's strategy is storybook-vitest play functions + pure-`.ts` logic tests (memory: `vitest-cannot-import-tsx`, `verify-visuals-by-measuring-dom`). Treat the flag as "no *behavioral* guard" and cover with the right mechanism:

- **View/gesture behavior** → a `.stories.tsx` play function driving the DOM (playwright/vitest).
- **Pure logic** → extract to a `.ts` sibling and unit-test (established for text ticker, calendar, drag geometry, input semantics).

**Order of attack (dependents first — a defect here has the widest blast radius):**

| File | Dependents | Mechanism |
|---|---|---|
| `display/DynamicIsland/dynamic-island.stories.tsx` | 27 | story play |
| `menus/HoverMenu/hover-menu.tsx` | 25 | story play |
| `display/SwipeableList/swipeable-list.tsx` | 23 | story play |
| `navigation/Tabs/tabs.tsx` | 22 | story play (also §1.3) |
| `form/WheelPicker/wheel-picker.tsx` | 20 | story play |
| `navigation/Dock/dock.tsx` | 19 | story play |
| `menus/FullSheet/full-sheet.stories.tsx` | 19 | story play |
| `file-system/FileSystem/views/*` (list/column/mobile-*) | 4–12 | story play + extract column math |
| `menus/MorphingSwitcher/morphing-switcher.tsx` | 5 | story play |
| `menus/MultiStepMenu/multi-step-menu.tsx` | 12 | story play |

**Done when:** each file above has a passing story play or paired `.test.ts`; `get_health` stops listing them under `untested_hotspot`.

### 3.2 Dead code (remaining after the earlier pass) — trivial

10 safe-to-delete exports, 319 lines, all no-importers at live HEAD:

- [surface.native.tsx::Surface](packages/ui/src/components/display/Surface/surface.native.tsx) (109 lines) — note this is the same file as §1.7's `zIndex` workaround; deleting it also removes the iOS workaround, so confirm no consumer relies on `Surface` first.
- [preview.tsx::preview](storybook/native/.rnstorybook/preview.tsx) (73) — confirm it's not a Storybook-convention-referenced export.
- [toaster.native.tsx::Toaster](packages/ui/src/components/display/Toaster/toaster.native.tsx) (47)
- [blur-provider.native.tsx::BlurProvider](packages/ui/src/components/menus/Overlay/blur-provider.native.tsx) (32) — wait: this is the Android provider that §1.7 says scrims *need*. Verify it's re-exported/consumed via a path the graph can't see before deleting.
- [overlay-blur.native.tsx::OverlayBlur](packages/ui/src/components/menus/Overlay/overlay-blur.native.tsx) (26)
- [hoverable.native.tsx::Hoverable](packages/ui/src/moti/interactions/pressable/hoverable.native.tsx) (2)
- [radius.ts::INTERACTIVE_PAD_X](packages/ui/src/lib/radius.ts) (0)
- Medium tier (0.7 confidence, review first): `lib/haptics.native.ts::fireHapticFeedback` (20), `resolve-icon-color.ts::useIconColor` (5), `.rnstorybook/index.tsx::StorybookUIRoot` (5)

**Careful:** two of these (`BlurProvider`, `Surface`) are named in §1.7's blur-constraint docs — deleting them silently would strand the workaround knowledge. Confirm their real usage (platform resolution / provider wiring may not show as import edges) before removing.

**Done when:** `get_dead_code(safe_only=true)` returns 0 in the high tier.

### 3.3 Metrics hygiene — exclude non-code from scoring (still open)

`CHANGELOG.md` (7.1% of gap) and `README.md` (1.4%) are ranked "high-leverage" purely because they're large and churn with releases. Exclude them from health scoring so the dashboard reflects real code.

**Done when:** `CHANGELOG.md` no longer appears in `high_leverage_files`.

### 3.4 Import cycles — reconcile the two tools

Repowise reports 6 cycles; `madge --circular` reports **0** in live code. Before spending any effort, reconcile which is authoritative (repowise's cycle detector may count type-only or dev-only edges madge ignores). If real, break them by moving the shared dependency into a leaf module — the established pattern (`OtpInputType` → `otp-input.logic.ts`, etc.).

**Done when:** the two tools agree (and ideally both read 0).

### 3.5 Harden recurring defect patterns (partially done)

The repo memory records bugs that have each bitten repeatedly. Items 1–3 below still need a lint/`check-*` guard; the rest are documented conventions:

1. **`withRepeat` loops leak on unmount** — every `useSharedValue` + `withRepeat` needs `cancelAnimation` cleanup. (Root cause of a past 15s storybook stall.)
2. **`HoldItem` memo defeated by inline `containerStyles`** — object-literal props re-run the stack.
3. **Moti retains removed `animate` keys** — variant-conditional keys need every branch or a `key={variant}` remount.
4. Children rendered twice (keep the decorative copy unnamed).
5. Hairlines must be the `hairline` utility (now 2px, §2.3).

**Done when:** a `check-*` script or biome rule exists for items 1–3, wired into `lint`/`test`.

---

## Sequencing & definition of done

Order by **impact ÷ risk**, interleaving the three pillars so each batch is independently shippable (repo convention: commit straight to `main`, `typecheck && lint && test` green).

| # | Batch | Pillar | Effort / risk |
|---|---|---|---|
| 1 | Dead-code removal (§3.2) | codebase | trivial / low (verify `BlurProvider`/`Surface` first) |
| 2 | Metrics hygiene (§3.3) | codebase | trivial / none |
| 3 | Elevation + hairline + radius normalization (§2.1–2.4) | consistency | small / low (visual-only) |
| 4 | Tighten the guard scripts (§2.2, §2.6, §2.3) | consistency | small / low |
| 5 | A11y labels + tablist + focus-visible + hit targets (§1.2–1.4) | UX | medium / low |
| 6 | Keyboard nav: Tabs, Radio/Checkbox, CommandPalette (§1.3) | UX | medium / low |
| 7 | Input parity for Holdable/Draggable + reduced-motion first-paint (§1.1, §1.6) | UX | medium / medium |
| 8 | Test the untested hotspots (§3.1) | codebase | large / low-medium (highest ROI) |
| 9 | Harden recurring patterns (§3.5) | codebase | medium / medium |
| 10 | Reconcile import cycles (§3.4) | codebase | verify-first / low |

### Success metrics

**UI consistency**
- 0 raw shadow recipes outside `elevated()` (Switch thumb, picker-thumb, Button, elevated-button).
- `check-no-hardcoded-colors` scans `lib/` + `theme/`, and no longer blanket-exempts shadows.
- `check-token-parity` covers `--shadow-*`/`--surface-*`/`--radius-*`/`--spacing-*`.
- 0 `border-[3px]` / raw `borderWidth` outside the hairline convention.

**UX**
- Every focusable menu trigger has `role` + `label` + `aria-haspopup`/`aria-expanded`; `HoldMenu` panel has `role="menu"`; `TabsList` has `role="tablist"`.
- Tabs + CommandPalette are keyboard-operable; a `:focus-visible` ring exists.
- All interactive controls have an effective ≥44px target.
- Native error toasts announce assertively.
- Reduced motion resolves before first paint.

**Codebase**
- Average health **≥ 8.0** (from 6.4); hotspot health **≥ 7.0** (from 5.12).
- 0 `untested_hotspot` in the top-25 weighted-deficit files.
- 0 high-tier dead-code findings; `CHANGELOG.md`/`README.md` excluded from scoring.
- 0 confirmed import cycles (both tools agree).
- The 5 bug-magnet files (≥11 fixes) show no new fixes over a 30-day window.

---

*Generated from Repowise (`get_health`, `get_dead_code`, `get_overview` at live HEAD `c97f814b`) + two file-level research passes (UI consistency, UX/accessibility) + repo memory.*
