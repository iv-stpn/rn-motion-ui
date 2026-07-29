# rn-motion-ui

## 3.4.0

### Minor Changes

- 281ac6a: feat(a11y): accessibility sweep of the overlay, carousel, progress and decorative components, plus a writing-direction primitive

  **Modal semantics.** `BottomSheet` and `ActionFeedbackModal` now expose `role="dialog"` with `aria-modal`, take an `accessibilityLabel`, and contain keyboard focus on the web through the new `useFocusTrap` hook — react-native-web renders `Modal` as an ordinary fixed `<div>`, so Tab previously walked straight out of an open sheet and into the page behind it, where a keyboard user could operate controls they could not see. Native already had containment from `Modal` itself, so the hook is a no-op there.

  `BottomSheet` also gains `closeAccessibilityLabel` (default `'Close'`): the backdrop is now a labelled button, because the drag handle it sits next to is a pointer-only affordance and was the only way to dismiss the sheet. The handle itself is now hidden from assistive technology.

  **Announcements.** `ActionFeedbackModal` wraps its state content in a persistent live region, so a spinner resolving to success or error is announced instead of changing silently. iOS gets an explicit `announceForAccessibility` — `accessibilityLiveRegion` is Android-only and VoiceOver does not re-read a subtree that mutated under it.

  **Values.** `CylinderCarousel` is now an adjustable control with a position value and working increment/decrement actions, giving it a non-pointer way to change slides for the first time. `ScrollProgress` reports `role="progressbar"` and a live percentage, mirrored off the UI thread in 5% steps so the indicator stays frame-driven.

  `RangeSlider` is fixed as part of this: it set React Native's nested `accessibilityValue`, which **react-native-web does not read at all** — it forwards only the flat `aria-value*` props — so on the web the slider announced no value whatsoever. Every value-bearing component now emits both spellings.

  **Decorative content.** `Skeleton` and `Marquee`'s duplicated track are hidden from assistive technology on native as well as web. The marquee previously read its entire contents out twice on iOS and Android.

  **Writing direction.** New `rn-motion-ui/hooks/use-direction` (`useDirection`, `useIsRTL`) and `rn-motion-ui/hooks/direction-provider` (`DirectionProvider`). These exist because `I18nManager.isRTL` cannot be the answer on its own: react-native-web's `I18nManager` is a stub whose `isRTL` is hard-coded `false`, so any component branching on it is silently LTR-only in every browser. The hook reads the right source per platform, and the provider states it explicitly for a subtree.

  `Marquee` is the first component wired up: `direction` accepts the logical values `'start'` (new default, identical to the old `'left'` under LTR) and `'end'` alongside the existing physical ones, and mirrors its travel under RTL — where the platform flips the belt's own row and the old direction tore a gap open in the loop instead of cycling.

  `Tabs` was audited and needs no change: its indicator and slide direction are both computed from measured geometry, which the platform mirrors along with the layout, so they come out right in either direction. That is now covered by an RTL story rather than left as an assumption. `TabsList` gained an optional `testID` — the sliding indicator is exposed as `${testID}-indicator`, so its position can be asserted.

  `RangeSlider` now mirrors under RTL: minimum on the right, filling leftwards, the way a native slider does in an RTL locale. Four things flip together — the pointer mapping (`locationX` is measured from the physical left edge whichever way the page reads, so without this the slider painted mirrored and then jumped to the wrong value on the first press), the fill's growth origin, the thumb's travel, and the tick positions. A new optional `writingDirection` prop opts out, for a track whose axis is a thing rather than a quantity — a timeline or a seek bar.

  `Table` cell alignment now follows the writing direction when a column does not set `align`. Previously the default paired a direction-relative `alignItems: 'flex-start'` with a hard-left `textAlign`, so under RTL the text sat on the left inside a right-aligned cell. An explicit `align: 'left' | 'right'` stays physical — a column of numbers asking for `right` means right. Column _order_ is untouched and now documented as the consumer's call: the table renders the `columns` array as given, since whether the first column belongs on the right depends on what the data means.

  `Table` column drag-to-reorder now mirrors as well. Its drop boundaries are accumulated from column widths in column order rather than measured, so unlike `Tabs` it could not inherit the platform's mirroring — the boundary table describes the logical axis while the pointer's `pageX` is physical, and under RTL the two run opposite ways. Dropping a column on the trailing physical edge now appends it in both directions, and the drop indicator lands on the boundary it marks rather than a column away. The row and column action overlays follow the trailing edge too, instead of pinning to the right.

  That geometry moved out of the hook into three new pure exports on `rn-motion-ui/table-utils` — `columnBoundaries`, `dropIndexAt`, `dropIndicatorX` — so the same drop-target maths a custom header needs is available without reimplementing it, and is unit-testable without a gesture.

  No breaking changes: every new prop is optional and the defaults preserve current behaviour.

- 6c97690: feat(FileSystem): `renderBody` slot for wrapping the file area

  `renderBody` decorates the file area instead of replacing it. Where `renderHeader` and `renderFooter` hand you a state snapshot and take whatever you return, this one also hands you `state.content` — the active view, or the empty/loading placeholder standing in for it — so a drop hint, an upload overlay or a details rail can sit alongside the four views without reimplementing any of them. Returning `state.content` unchanged is a no-op.

  ```tsx
  <FileSystem
    renderBody={({ content, isEmpty }) => (
      <View className="flex-1">
        {content}
        {isEmpty ? <DropHint /> : null}
      </View>
    )}
  />
  ```

  The snapshot is the state that produced the content — `currentPath`, `entries`, `view`, `selectedEntry`, `searchValue`, `isSearching`, `hasActiveFilters`, `isLoadingCurrentFolder`, `isEmpty` — exported as `FileSystemBodyState`, so a wrapper tracks the same selection and folder the views do without recomputing any of it.

  `isEmpty` is not the same as "the placeholder is showing": the columns view keeps its panes over an empty folder, since that is how Finder lets you walk back up a trail, so it only yields to the placeholder while searching or filtering.

  Unlike the header and footer slots, `renderBody` is **called as a plain function rather than mounted as a component**. An inline arrow is a new function identity on every render, and a component whose _type_ changes remounts its entire subtree — here that subtree is the active view, so every keystroke in the search field would have reset its scroll offset, its panes and any in-flight drag. Calling it keeps the returned elements in the parent's own tree, where reconciliation compares them by position as usual. The consequence for callers: don't call hooks directly inside `renderBody` — put them in a component you render inside the returned tree.

  The wrapper renders _inside_ the file-area node rather than around it, so `bodyClassName` still applies and the area keeps its flex sizing and web text-selection guard however you nest things. Give the returned tree `flex-1` (or `size-full`) if it should fill the area the way the built-in views do.

- 6c97690: feat(elevated): export `SURFACE_CLASSNAME`, and drop the built-in frame from `FileSystem` and the `AdaptiveDropdown` panel

  New `SURFACE_CLASSNAME` on `rn-motion-ui/elevated` — a level-indexed map pairing each surface background with the matching elevation shadow, so a custom surface can take both halves of the ladder at one level without calling `surfaceBackground` and `elevatedShadow` separately.

  ```ts
  import { SURFACE_CLASSNAME } from "rn-motion-ui/elevated";

  <View className={SURFACE_CLASSNAME[5]} />; // bg-surface-5 shadow-elevated-5
  ```

  It is a plain record, not a function, so it is indexed rather than clamped: `surfaceBackground` and `elevatedShadow` still take any number and clamp it into range, while an out-of-range index here is a type error and, from untyped JS, `undefined`. Reach for the functions when the level is computed at runtime.

  **Visual change.** `FileSystem`'s root no longer draws `rounded-xl border border-border`, and `AdaptiveDropdown`'s floating panel no longer draws `border border-border`. Both now render an unframed surface, leaving the frame to the container they sit in — a `FileSystem` inside a card or a pane of its own was stacking two borders, and there was no way to opt out.

  `FileSystem` takes the old chrome back through `className="rounded-xl border border-border"`; the shared `cn` resolves consumer classes last-wins, so it applies. The dropdown panel has no such escape hatch — `contentClassName` reaches the body inside the panel, not the panel itself — so its border cannot currently be restored from the outside. It keeps its `rounded-2xl` and its `elevation` shadow, which is what separates it from the page.

  Internally, the per-file `cn` copies in `Card`, `Skeleton` and `AdaptiveModal` — each a comment claiming the package ships no shared `cn` — are replaced by the real `src/lib/cn.ts`. Those copies only concatenated, so a consumer class and a component default targeting the same utility group both survived into the class string and the winner came down to stylesheet order. They now resolve last-wins in the consumer's favour, which is what their prop docs already promised.

- 58c7e45: feat(hooks): export `useSafeInsets` at `rn-motion-ui/hooks/use-safe-insets`

  The hook shipped in the source tree with the `safeArea` overlay work but was never added to the package's `exports` map, so consumers could not import it — `rn-motion-ui/hooks/use-safe-insets` resolved to nothing while every other hook was reachable.

  It resolves device safe-area insets through `react-native-safe-area-context` when that optional peer is installed and a `<SafeAreaProvider>` is above in the tree, and returns zeros otherwise — the same resolution the overlay components use internally, now available for building your own full-screen surfaces.

  ```ts
  import { useSafeInsets } from "rn-motion-ui/hooks/use-safe-insets";
  ```

### Patch Changes

- 2c7878d: fix(MorphingModal): close on overlay tap on the web

  Tapping the scrim did nothing on react-native-web. The layer that positions the card fills the whole modal and is meant to let taps through to the scrim behind it, which it asked for with `style={{ pointerEvents: 'box-none' }}`. But `box-none` is not real CSS — react-native-web implements it in the StyleSheet compiler, which expands it into `pointer-events: none` on the node plus `pointer-events: auto` on its direct children. That expansion only runs for compiled styles; the inline-style path passes the value straight to the DOM, where the browser discards `pointer-events: box-none` as invalid and the node keeps the default `auto`. The positioning layer therefore sat on top of the scrim and swallowed every tap. Moving the style into `StyleSheet.create` runs it through the compiler. Native reads the same style object directly and was unaffected.

  `testID` now also propagates to the scrim as `<testID>-backdrop`, matching `BottomSheet`, so the dismiss target is addressable from tests.

## 3.3.0

### Minor Changes

- 465ac98: feat: `useBreakpoint` — width breakpoints without resize re-renders

  New `rn-motion-ui/hooks/use-breakpoint` exports `useBreakpoint()` and
  `useBreakpointAtLeast(value)`. Both subscribe to `Dimensions` but store only the
  resolved tier, so a component re-renders when the breakpoint flips rather than
  on every resize frame the way `useWindowDimensions` does.

  The scale (`base` / `sm` / `md` / `lg` / `xl` / `2xl`) mirrors Tailwind's default
  `screens` and is the single source of truth for responsive decisions in the
  package — the pure helpers live in `rn-motion-ui/breakpoints` for components that
  measure their own container instead of the window.

  Every component that previously hard-coded a cutoff now accepts an override:

  - `AdaptiveModal`, `FullSheet` — `wideBreakpoint` (default `'sm'`, was a literal 640)
  - `AdaptiveDropdown` — `wideBreakpoint` (default `'md'`, was a literal 768)
  - `FileSystem` — `breakpoints={{ minimal, compact, tablet }}` for its
    container-measured header tiers (defaults 360 / 560 / 768), plus
    `contextMenuWideBreakpoint` (default `'md'`, was a literal 768) for the window
    width at which entry context menus open as a cursor-anchored panel rather than
    a bottom sheet

  Each takes a breakpoint name or a raw pixel number. Defaults are unchanged, so
  this is additive.

- ab84da1: One shared box for the whole button family, driven by tokens. `Button`, `ElevatedButton`, `GlossyButton` and `ActionSwapButton` had each grown their own height/padding/radius table, so an `md` of one type didn't line up with an `md` of another. They now all read the same geometry from `tokens.css` — `--spacing-button-{sm,md,lg}` (32/40/48px), `--spacing-button-pad-{sm,md,lg}` (12/16/20px) and `--radius-button-{sm,md,lg}` (8/10/12px) — so a row of mixed button types has one baseline, and overriding a token retunes every type at once.

  `ActionSwapButton` joins the family properly: it takes a `shape` prop (`'pill' | 'rounded'`, default `'pill'` so existing buttons look the same), its `size` is now the family's `ButtonSize`, and its label uses the family's type ramp instead of a duplicate of it. `ActionSwapButtonSize` is now an alias of `ButtonSize` and `ActionSwapButtonShape` of `ButtonShape` — both still exported.

  Visible changes, per type:

  - **`Button`** — `md` and `lg` lose 4px of horizontal padding (20→16, 24→20); the `rounded` shape moves off a flat 12px radius onto the 8/10/12 ramp; `icon` grows from 32 to 40px so it squares the `md` height.
  - **`ElevatedButton`** — padding grows 2–4px per size (10→12, 14→16, 16→20); `icon` grows from 32 to 40px. Radii are unchanged (AlignUI's 8/10/12 is what the shared ramp was drawn from), and its 14px label is still the documented opt-out from the type ramp.
  - **`GlossyButton`** — `md` grows 36→40px and `lg` 44→48px to join the family's height ramp; padding drops at `md`/`lg` (20→16, 24→20) and grows at `sm` (10→12); `icon` grows 36→40px; the `rounded` shape moves off a flat 12px radius onto the ramp. The 2px inset around the label is gone, so a glossy label sits at the same inset as a flat one.
  - **`ActionSwapButton`** — same height and padding as before at every size. Its content gap is now a flat 8px (was 6 at `sm` and 10 at `lg`).

  Adornment spacing is one value across the family now (8px). `ElevatedButton` previously spaced its content at 12px and pulled icons back in by 4px, which netted the same 8px beside a label — the difference only showed with two adornments.

  `StatefulButton`'s success/error padding squeeze is derived from the shared padding rather than tabulated, so it stays proportional if a token is overridden.

- de66bc8: feat(ui): `FileSystem` headless header/footer slots + per-region classNames

  `renderHeader` and `renderFooter` replace the built-in toolbar and status bar
  with your own UI. Each receives the same state the default region renders from,
  so a custom header wires navigation, search, sort and filters without
  reimplementing any of the logic:

  ```tsx
  <FileSystem
    items={items}
    renderHeader={({ folderName, canGoBack, goBack, searchValue, setSearchValue, layout }) => (
      <MyToolbar … />
    )}
  />
  ```

  The state shapes are exported as `FileSystemHeaderState` and
  `FileSystemStatusState`. Both include the responsive hints the built-in header
  uses (`layout`, `isCompact`), so a custom region can collapse at the same widths.

  For the common case of restyling rather than replacing, four class hooks merge
  onto the built-in regions: `headerClassName`, `bodyClassName`, `footerClassName`
  and the existing `className`. The two `render*` props take precedence over their
  matching `*ClassName`.

  Defaults are unchanged — omit everything and the component renders exactly as
  before.

- 19c5bbc: `HoverMenu`'s render-prop `trigger` now receives `{ open, toggle }` instead of just `{ open }`, matching `AdaptiveDropdown`. A trigger that is pressable in its own right (a `Button`, a `Pressable`) claims the press, so the wrapper's own toggle never fires — `toggle` is what lets such a trigger open the menu. Also adds `triggerIsPressable`: set it and the wrapper drops its button role, `aria-expanded`, `onPress` and tab stop, since the trigger already carries all four. Without it, web renders a `<button>` inside a `<button>` and keyboard users get two tab stops for one control. Hover stays on the wrapper either way, so web hover-open is unaffected. Both are additive — a plain node trigger keeps the wrapper-owns-the-press behaviour unchanged.

  Stories: add the `glossy` trigger kind to the shared story `TriggerButton`, which gives every overlay playground that showcases trigger variants (ActionFeedbackModal, AdaptiveModal, BottomSheet, CommandPalette, FullSheet, MorphingModal) a GlossyButton chip. The `HoverMenu` and `AdaptiveDropdown` playgrounds gain that same Trigger chip row, so all four launch styles can be swapped under one live overlay; each keeps its previous plain-node trigger in a section of its own to demonstrate the wrapper-owns-the-press path.

- f2d4ba4: feat(overlays): safe-area insets on by default for full-screen overlays

  `FullSheet`, `BottomSheet`, `Drawer`, and `AdaptiveModal` now accept a `safeArea` prop (default `true`) that applies device safe-area insets — status-bar top and home-indicator bottom — to the overlay content.

  When `react-native-safe-area-context` is installed and a `<SafeAreaProvider>` is present in the tree, real device insets are used. If the package is absent, insets fall back to zero so existing consumers without it are unaffected.

  Pass `safeArea={false}` to opt out and manage insets yourself.

- 8d996ce: **Breaking — `StatefulButton`'s `elevated` prop is replaced by `chip`.** `elevated` was a boolean with one alternative to the flat button; there are now two chip keys, so the flag becomes a mode:

  ```diff
  -<StatefulButton elevated onPress={submit}>Save</StatefulButton>
  +<StatefulButton chip="elevated" onPress={submit}>Save</StatefulButton>
  ```

  Omitting `chip` renders the flat button, exactly as omitting `elevated` did. `elevated` is gone rather than deprecated — it shipped one release ago in 3.2.0, and keeping a boolean that means "one particular chip" beside the mode it is a subset of reads worse than the rename costs.

  The new value is `chip="glossy"`: the `GlossyButton` key (domed SVG gradient, inset bevel, OKLCH-derived cast) driven through the same machine. Either key keeps its full appearance through loading/success/error instead of greying out, and each state adopts the matching variant — idle/loading map the flat variant onto that key's palette (danger family → `danger`, `special`/`inverse` carry over, everything else → the key's neutral fill), success switches to the `success` key, error to the `danger` key. Full fill, gloss, rim and cast, not a flat overlay: neither chip paints the flat button's crossfaded colour plate, because it has a variant to switch instead. Glossy dims whole-key via opacity rather than recolouring its label, so its idle content colour comes from `glossyContentColor` and holds constant across states.

  The success/error horizontal padding squeeze is now derived from the family's shared `--spacing-button-pad-*` rather than tabulated per size, so retuning a padding token keeps the squeeze proportional.

- fd1d111: `Tabs` gains a choice of content-panel animation. `contentAnimation` on `Tabs` sets it for every panel, and `animation` on a single `TabsContent` overrides it for that panel only:

  - `fade` (default) — the existing cross-fade with a 4 px settle, unchanged, so nothing shifts for current consumers.
  - `slide` — the panel you land on travels a full container width in from the side the selection moved towards, while the panel you left is pushed out the opposite way, so the pair reads as one page displacing another rather than as a nudge. Sized for mobile screens and modals. Direction is read off the triggers' measured rects rather than the order the panels were declared in, so it also holds for controlled changes: a programmatic jump to a tab slides the same way a press on that tab would. Travel distance is measured on the `Tabs` root, so the first panel — which has no previous page to push out — just fades in.
  - `dropIn` — the panel falls from above on a springy scale-up.

  `fade` and `dropIn` are enter-only: `TabsContent` renders nothing for the tab it isn't showing, so a switch is an unmount plus a fresh mount, with no exiting layer to co-ordinate. `slide` is the exception, since a page swap only reads as one if the page you left is visibly pushed aside. The outgoing panel keeps its subtree mounted for the length of the push, leaves the layout flow immediately so it can't displace the panel replacing it, and finishes the trip as an absolutely positioned layer over the spot it held — hidden from assistive tech and non-interactive while it travels, then unmounted. Under `prefers-reduced-motion` every animation collapses to the same plain opacity fade with no exit layer at all — the cross-fade is information, the transforms are decoration.

  A full-width slide has to be clipped or the travelling pages paint outside the `Tabs` box, so `slide` panels mount inside an `overflow: hidden` wrapper. The clip is scoped to the motion: an arriving panel lifts it once it has landed, which keeps shadows and any overlay a panel raises inline from being cut off for the rest of the panel's life, and a departing panel simply stays clipped until it unmounts.

  `contentTransition` is the matching escape hatch, partial like `indicatorTransition`: pass only the fields you want changed and the rest come from that animation's default (180 ms timing for `fade`, 280 ms linear for `slide`, a spring for `dropIn`).

  Story: the playground gains a Content animation chip row wired to the live controlled set, a section with one tab set per animation for clicking through them side by side, and a modal-width sample where the full-width slide reads properly. `Demo: Slide (both directions)` tours forward and back at that width.

- 0cae697: Per-entry `testID`s in the file browsers, so every row/tile is addressable on its own. The id is keyed by the path that already identifies the entry (folders keep their trailing slash), the way `Table` keys rows by id. No new props: the ids derive from the component's root `testID`, falling back to the component name when it is omitted.

  - `FileTree` — each row is `${testID ?? 'file-tree'}-row-${path}`. A row pinned by the sticky headers is a second copy of a row that may also be in the list below it, so it takes `${testID ?? 'file-tree'}-sticky-row-${path}` instead — one query resolves to one node, whichever copy a test means. Previously every row shared a single `${testID}-row`.
  - `FileSystem` — each entry is `${testID ?? 'file-system'}-entry-${path}`, the same id in all four views (list rows, icons tiles, columns rows, gallery filmstrip tiles), so a test that switches views keeps its queries.

  Additional per-item `testID`s, filling the gaps left by the previous release:

  - `CardChoice` — accepts `testID` and forwards it to the card `Pressable` (standalone or inside a `CardChoiceGroup`). Inside a group it now defaults to `${group testID ?? 'card-choice-group'}-card-${value}`, keyed by the `value` that already identifies the card, so cards are addressable without threading ids through each one. The radio ring is `-ring`, its standalone dot `-dot`, the badge `-badge`, and the group's gliding indicator `${testID ?? 'card-choice-group'}-indicator`. A standalone card has no group and no `value` to key on, so its inner ids only appear when you pass a `testID`.
  - `RadioGroupItem` — each item defaults to `${group testID ?? 'radio-group'}-item-${value}`, with the ring at `-control` and the group's gliding indicator at `${testID ?? 'radio-group'}-indicator`. Previously only an explicitly passed `testID` reached the item's `Pressable`.
  - `CommandItem` — new optional `testID` field; forwarded to each row's `Pressable` in `CommandPalette`.
  - `BouncyAccordionItem` — new optional `testID` field; forwarded to each row's trigger `Pressable`.
  - `TabsContent` — accepts `testID` and forwards it to the content wrapper.

- a981e3b: New `ThemedIcon` at `rn-motion-ui/icon` wraps any icon from `rn-motion-ui/icons` and resolves its stroke colour from the active theme, so an icon can be placed by the name of the surface it sits on rather than by a colour threaded down from a hook call.

  Two ways to name that colour, `token` winning if both are given:

  - `variant` takes any `ButtonVariant` or `ElevatedVariant` name and maps it to that fill's legible partner — `variant="primary"` gives `primary-foreground`, `variant="ghost"` gives `muted-foreground`, `variant="success"` gives `success-foreground`, and the outline/ghost danger variants give the `danger` hue itself since there is no fill to sit on. The mapping is the same one `ElevatedButton`'s `elevatedContentColor` and `Button`'s label cva already use, so an icon passed as a button adornment lands on the colour that button's own label would. Defaults to `secondary`, i.e. the plain `foreground` token.
  - `token` skips the lookup and resolves a `ThemeToken` directly, for icons whose colour isn't a button variant — a `success-foreground` check inside a green circle, or a colour that flips between two tokens on a state, `token={isActive ? 'foreground' : 'muted-foreground'}`.

  Everything else in `IconProps` (`size`, `strokeWidth`, `style`, `accessibilityLabel`) is forwarded untouched.

  Internally, the components that were each calling `useThemeColor`/`useThemeColors` solely to hand a colour to an icon now use it instead: `ActionFeedbackModal`, `BloomMenu`, `BouncyAccordion`, `CommandPalette`, `FeedbackWidget`, `FileTree`'s search input, `Input`, `OtpInput`, `OverflowActions`, `Table`'s pagination footer, and the `FileSystem` toolbar, header, list view, menus, filter menu, filter pills, and date-range modal. Rendered colours are unchanged. Where the icon wanted the `foreground` token anyway, the wrapper is dropped altogether — icons already fall back to `foreground` when given no `color`, as in `BloomMenu`'s cells.

  `MenuRow` in `MultiStepMenu` gains `iconColor`, defaulting to the `white` it previously hard-coded. That default is right for the vivid iOS-style icon squares the row is built around, but `iconBackgroundColor` is a free-form colour, and a pale or neutral fill needs a darker icon to stay legible. Its active label also moves from a literal `text-white` to `text-primary-foreground`, which is the same colour but follows the theme.

### Patch Changes

- ab84da1: `GlossyButton` labels now use the Button family's type ramp instead of their own. The ramp moves to `LABEL_TEXT_CLASS` in `button-scale.ts`, and both `Button`'s `label` cva and `GlossyButton` read it, so a glossy `md` renders the same text as a flat `md` — which is what `StatefulButton`'s `chip="glossy"` was already doing for its rolling label. Visible change: glossy labels go `font-medium` on the `text-xs`/`text-sm`/`text-base` ramp rather than `font-normal` at a fixed 17px (14px at `sm`). `ElevatedButton` is unchanged — AlignUI pins its chips to 14px at every size.

## 3.2.0

### Minor Changes

- d8bf622: Add the `special` and `inverse` variants to `Button` and `ElevatedButton`, so all three button families now cover the same palette as `GlossyButton`. `special` fills with the non-semantic `special` token — for promotions and upgrade paths, where `info`/`success`/`warning`/`danger` each carry a meaning. `inverse` fills with `foreground` and punches its label through to `surface-1`: deliberately not `primary`, which is the consumer's brand token and designed to be overridden, so a fill built on it can't promise contrast. Untinted the two land in the same place; they diverge the moment a consumer sets a brand hue.

  Both variants get each component's full treatment — on `ElevatedButton` that means the gloss, rim highlight and coloured drop-shadow ring, with `inverse` casting the fixed dark-neutral drop that `neutral` already used rather than a tint of its own fill (darkening a near-white dark-mode fill would put a pale grey haze under the chip instead of a shadow). `StatefulButton` carries both through to its elevated chip, so `variant="special"` with `elevated` now renders the violet chip in idle/loading instead of collapsing to `neutral`. `Button`'s ripple polarity also now treats every opaque fill as filled — `danger`, `special` and `inverse` previously got the dark shimmer meant for transparent and light-plate variants.

- e43dfc2: Add `CardChoiceGroup` to `rn-motion-ui/card-choice`. Wrapping `CardChoice` cards in a group renders a single shared indicator dot that glides between cards on selection (spring-animated, reduced-motion aware) instead of each card toggling its own dot. `CardChoice` gains a `value` prop for group use; standalone `selected` + `onPress` continue to work unchanged.
- 8cde891: Add `ElevatedButton` component (`rn-motion-ui/elevated-button`). Glossy filled chip with top-down white sheen, 1px SVG rim highlight, and a multi-layer coloured drop-shadow ring. Supports 7 variants: `neutral`, `danger`, `success`, `warning`, `info` (glossy fills) and `white`, `gray` (flat plates). Hover lifts the gloss; `white` darkens on hover; `gray` is a fixed Geist-style secondary plate. Shares press interaction and content layout with `Button` via `button-internals`.
- df37c21: Add `FileSystem` (`rn-motion-ui/file-system`), a Finder-style browser over a flat manifest of files. Like `FileTree` the path is the identity — folders carry a trailing slash, the empty string is the root, and missing folder prefixes are inferred from file paths, so an object-store listing can be handed in as-is; folders with no metadata of their own inherit their newest descendant's modified date. Four presentations share one state core: an icons grid, a list with sortable columns and expandable folder rows, Finder-style columns panes, and a gallery with a large stage, a metadata sidebar on wide viewports and a filmstrip. The toolbar carries back/forward history, search, a sort menu, and a filter menu with a MIME-bucketed file-type checklist plus date created/modified facets (relative presets or a custom range picked in a calendar modal); active filters show as pills whose operator can be switched in place. Files render externally generated thumbnails — the component rasterizes nothing itself — with a pager for multi-page previews that fetches pages on demand through `loadPreviewImageUrl`, falling back to a file-type icon tinted from a per-language colour token reusing FileTree's extension table. URLs resolve through `getFileUrl` behind a component-lifetime cache (no repeat presign, no loading flash on revisit) and folders advertising `hasChildren` fill in through cursor-paged `loadChildren`. Opening a file (double-click on web, second tap on native) shows images in a built-in viewer modal, hands the other viewable kinds to `renderFileViewer`, or defers entirely to `onFileOpen`. The header adapts to the component's own measured width rather than the window's — shedding affordances at 560px and 360px, collapsing the four-tab view switcher into a dropdown below 768px — and its menus become bottom sheets under the md breakpoint via `AdaptiveDropdown`, which now also exports its `TriggerRenderProps` / `ContentRenderProps` render-prop types. Entries carry a context menu when `getContextMenuActions` is supplied — right-click on web, long-press on native, in all four views — resolved synchronously so the panel opens with no loading state, and reporting the pick through `onContextMenuAction`; actions take an icon, a `destructive` tint and a `disabled` state, the panel is a plain modal pinned to the cursor on wide viewports and a bottom sheet on narrow/native, and opening one closes whichever was already open. With `draggable`, entries can be dragged onto folders in the list and icons views — an RNGH pan on native, pointer capture on the scroll container on web (mirroring FileTree, so a mouse click-drags immediately while touch waits for a hold and can still scroll) — with the live target outlined, edge auto-scroll, the post-release click swallowed, and a drop into the dragged folder's own subtree refused; `onMove` reports `{ sources, destination }` and the component mutates nothing itself. Adds `ArrowLeft`, `ChevronLeft`, `Columns3` and `Funnel` to `rn-motion-ui/icons`.
- de5ab7f: Fix hover highlights and drag-source tinting in `FileSystem` and `FileTree` under pointer capture.

  **FileSystem.** The web drag transport takes `setPointerCapture` on the scroll container, which stops the browser updating `:hover` and stops RNW firing `onHoverIn`/`onHoverOut`. The hover highlight was therefore freezing on the drag's origin cell for the duration of the drag. The highlight is now driven by the container's own `pointermove` stream — which continues firing under capture — through a `FileSystemHoverController`; position and opacity live in `Animated` values written directly from the DOM listener, so tracking the pointer costs zero React re-renders. Grid geometry for the icons view is extracted into a pure-math module (`file-system-icons-grid.ts`) that both the tile layout and the hover/drag resolvers share, so the cell the highlight marks and the cell a drop commits to are always the same cell. `FileSystemIconsTile` is extracted as a standalone component whose face is reused by the drag ghost, keeping the lifted copy pixel-identical to the tile it came from.

  In the icons view the highlight is sized to the tile's glyph box rather than the whole tile, so hover, selection and a pending drop all mark the same rect. Under a drag it is positioned from the resolved drop target instead of the pointer: the source tile no longer stays lit, a tile merely passed over no longer lights up, and a pointer sitting in the gap between tiles still marks the folder a drop would commit to — the highlight and the label chip can no longer disagree.

  **FileTree.** Rows own their hover state through RNW's `onHoverIn`/`onHoverOut`, but those are `pointerenter`/`pointerleave` underneath — they stop arriving once pointer capture is active. The row a drag starts from kept its hover tint for the length of the drag; every row the pointer passed over got none. A new `FileTreeDragContext` broadcasts the live dragged-path set to all rows: while a drag is in flight each row reads this context instead of its own hover, holding the tint on the source rows and clearing it everywhere else. The drop-highlight resolver (`resolveDropHighlightPath`) no longer marks a row when the drop would be a no-op (every dragged item already lives in the target directory, which covers hovering the drag source itself) or when the target is the root (which has no row to outline).

- 71e464e: Add `FileTree` (`rn-motion-ui/file-tree`), a path-first file tree UI ported from `@pierre/trees` to React Native + react-native-web. The path is the identity (no numeric IDs): feed a flat path list and missing ancestor directories are inferred, single-child folder chains flatten into one row, and rows sort dirs-before-files in natural order. Features expand/collapse, file-type icons, indent guides, single/multi selection, three search modes (`expand-matches` / `collapse-non-matches` / `hide-non-matches`), git-status lanes with rollups, density presets, sticky folder headers, inline rename, and drag-and-drop (an RNGH pan on native, raw pointer events on web — where a mouse click-drags immediately and only touch waits for a hold, so a finger can still scroll). Touch model is tap-to-select/expand plus long-press for multi-select/context actions — or, with `draggable`, long-press starts the drag instead; on web the ported click-plan still honours Ctrl/Shift-click, right-click, double-click, and keyboard navigation. Declarative-first API (`paths` + controlled state + callbacks, mirroring `Table`) with an imperative escape hatch: `useFileTree()` returns a stable `FileTreeController` for `<FileTree model={...} />`.
- fdbd888: Add an `npx rn-motion-ui-tokens` CLI that generates a retinted copy of `tokens.css` for consumers. The neutral ramp's shared tint can't be a `var()` — uniwind folds colours to hex at bundle time and `var()` inside `oklch()` never folds on native — so retinting is a codegen step. The script reads the shipped sheet, rewrites only the neutral-tinted `oklch()` literals to a given `--hue`/`--chroma` (scaling each token's chroma proportionally so partial tints stay partial), and passes comments, shadow recipes, status colours, and all three theme blocks through verbatim. Documented in the README's Theming section.
- d8bf622: Rebuild `GlossyButton` on an explicit primitive table. The key is now specified as seven fixed lighting slots — top and bottom edge hairlines, a rim, top and bottom spotlights, and a near and far cast — plus a dome gradient and a hover/active tint, all resolved per face rather than computed inline. Three families feed those slots: the translucent `neutral` key and the new `inverse` key are hand-authored per scheme, and every other face (status tokens, the pinned `gray` plate, and any `color` you pass) derives its rim and cast from the face's own OKLCH — a rim 0.17 lightness below the face at 0.65× its chroma, a cast pinned to lightness 0.25 at 0.4× chroma. The lighting branch follows the _face_, not the page, so a near-black key on a light page picks up the dark-face treatment (pale edges, no spotlights) instead of black-on-black bevels, and a light key on a dark page keeps its sheen. Layer order now matches the CSS original: spotlights, then rim, then edges, then the dome, then the tint — previously the tint painted _below_ the bevel and dome, which swallowed it on dark faces. Presses fade the spotlights, edges and cast to zero while the rim holds, so the key sinks rather than flattening; the tint animates opacity only and snaps its colour between the hover and active values. Ripple polarity now follows face lightness, fixing a dark shimmer on vivid light-page faces.

  Adds two variants: `inverse` fills with `foreground` and punches the label through to the page colour, distinct from `primary` which is meant to be overridden downstream; `special` fills with the new `special` token. Removes the `white` and `dark` variants — both were plates pinned against one scheme, which `inverse` covers when you want the opposite of the page and `color="#fff"` / `color="#191919"` covers when you want a literal plate. `gray` stays as the one fixed plate. Adds `--color-special` / `--color-special-foreground` (`oklch(59% 0.25 295)`, violet) as the one non-semantic status member, for promotions and upgrade paths where the other four each carry a meaning. Retints `--color-info` to `oklch(52% 0.24 264)` and `--color-warning` to `oklch(58% 0.18 40)`, and corrects dark-scheme `--color-danger` to `oklch(66% 0.22 25)` so it matches the native table. Those token changes also reach `ElevatedButton`, `AnimatedBadge`, `FileTree` and `SwipeableList`. A new `check-token-parity` CI guard now holds the `@media (prefers-color-scheme: dark)` block, the `.dark` block, and the native `LIGHT_OKLCH`/`DARK_OKLCH` tables to the same values.

- 954cadc: Remove ascii, comet, scramble, newton, helix, and percent loader variants; keep spinner, dots, bars, dot-matrix, and dither.
- ad5afb0: OTPInput: tap any slot to move the edit caret there (not just the first empty cell). Editing logic extracted to `otp-input.logic.ts` (pure, RN-free, unit-tested) and switched to fixed-grid overwrite semantics via `applyEdit` — a typed digit replaces the active slot in-place instead of shifting the tail. Fixes a RNW caret-drift bug where a tap on slot N could land the keystroke in slot N+1. `onComplete` now fires on every edit that yields a full-length code (not only the first incomplete→complete transition), so retyping a slot of an already-complete code re-validates.
- 42040d5: StatefulButton: add an `elevated` prop that swaps the flat button for the glossy `ElevatedButton` chip. The chip keeps its gloss/fill/rim/coloured drop-shadow through the whole state machine instead of greying out, and each state adopts the matching elevated variant — idle/loading map the flat variant onto the palette (danger family → `danger`, everything else → the monochrome `neutral` fill), success switches to the glossy `success` chip and error to the glossy `danger` chip (full fill, not a flat overlay).

  ElevatedButton: add a `noDisabledOpacity` prop that keeps a non-interactive chip's gloss/fill/shadow instead of flattening to the muted plate, and export `elevatedContentColor(variant, disabled, colors)` so a consumer rendering its own content can match the chip's label/icon colour exactly.

- ce4021b: Comprehensive `testID` coverage across all components.

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

- 89d801d: Add `variant` to `WheelPicker` (`'card'` | `'plain'`, default `'card'`).

  `card` is the existing self-contained control: elevated `Card` surface with an inset rounded centre pill. `plain` drops the container entirely — transparent, no surface, no shadow, no radius of its own — so several wheels can be butted together inside one parent frame and read as a single control (a date picker, say). Previously this needed per-wheel style overrides (`borderWidth: 0`, `backgroundColor: 'transparent'`) that fought the `Card` instead of replacing it, and left every wheel painting its own shadow underneath the shared frame.

  The rounded centre pill survives in both variants, since it is what marks the selected row; `plain` just uses a tighter horizontal inset so a narrow column (a 56px day wheel) still gets a readable band and adjacent wheels keep distinct pills rather than fusing into one bar. `elevation` is ignored under `plain`.

### Patch Changes

- 65cc7fd: ActionFeedbackModal: skip the loading/success text block entirely when no text props are set. Each state block is a flex child of a `gap-4` column, so an empty one still added a stray 16px gap under the morph icon — the minimal variant (icon only) now sits flush.
- 1e3c1c6: Extract shared Button family machinery (`usePressRipples`, `buildButtonContent`, `ButtonRipples`, `BaseButtonProps`) into `button-internals.tsx`. `Button` now delegates to those helpers, removing ~120 lines of duplication. `StatefulButton` cascade animation simplified to a whole-label roll (per-character stagger removed).
- 3dbc485: Docs: update the README colour-token table and `useThemeColors` example to use `danger` instead of the old `destructive` token name (the token was renamed in a prior release). Also refine the `useMotify` presence-unmount effect's dependency list and lint suppressions (no behavioural change).
- 064ecb6: Fix `DynamicIsland` pill background: use `bg-black` instead of `bg-foreground` so the pill stays black in both light and dark themes.
- fbde0be: Fix `NotFound` home button label colour: use `text-foreground` instead of `text-primary-foreground` so the label is readable on the button's `bg-primary` fill.
- d68328b: Storybook: rebuild the component stories around a single interactive playground per component, and expand `play`-function coverage.

  Each component now exposes one `Interactive` story that doubles as its catalogue — live controls on top, then rows of samples for the states a press can't reach — replacing the long tails of one-argument stories (`Loading`, `Disabled`, `Pill`, …) that used to sit beside each other in the sidebar. The shared chrome lives in `src/__stories__/story-harness.tsx` (`Playground`, `Controls`, `Toggle`, `Choice`, `Action`, `Section`, `Variants`, `Sample`, `Note`), with `story-trigger.tsx` supplying a swappable open-trigger for the overlay stories and `story-elevations.ts` the shared 1–8 elevation chip table.

  The harness is deliberately built from bare `Pressable`/`View` rather than the library's own `Switch`/`Radio`, so a story for `Switch` never has the harness and the subject answer the same `findByRole('switch')` query; every control carries a `story-*` `testID` so `play` functions can drive it unambiguously.

  `src/**/__stories__/**` is added to the package's `files` exclusions, so the harness ships no more than the stories it serves do.

- 8b70edb: Fix `TextShimmer` rendering black in dark mode and shimmering imperceptibly. The animated characters bypassed the themed `Text` component, so they fell back to React Native's default black regardless of theme, and moti's declarative `loop` rebuilt its `withRepeat` inside the worklet on every re-render — any theme toggle or parent state change left the repeat with almost no distance to travel and flattened the effect. The sweep now owns a single Reanimated shared value created once, and interpolates each character between `color` (default `muted-foreground`) and `highlightColor` (default `foreground`) as a narrow band travels across the string, so it tracks the active theme and stays fully legible while animating. Both colours are overridable per instance.

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
