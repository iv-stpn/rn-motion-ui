---
"rn-motion-ui": minor
---

feat(a11y): accessibility sweep of the overlay, carousel, progress and decorative components, plus a writing-direction primitive

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

`Table` cell alignment now follows the writing direction when a column does not set `align`. Previously the default paired a direction-relative `alignItems: 'flex-start'` with a hard-left `textAlign`, so under RTL the text sat on the left inside a right-aligned cell. An explicit `align: 'left' | 'right'` stays physical — a column of numbers asking for `right` means right. Column *order* is untouched and now documented as the consumer's call: the table renders the `columns` array as given, since whether the first column belongs on the right depends on what the data means.

`Table` column drag-to-reorder now mirrors as well. Its drop boundaries are accumulated from column widths in column order rather than measured, so unlike `Tabs` it could not inherit the platform's mirroring — the boundary table describes the logical axis while the pointer's `pageX` is physical, and under RTL the two run opposite ways. Dropping a column on the trailing physical edge now appends it in both directions, and the drop indicator lands on the boundary it marks rather than a column away. The row and column action overlays follow the trailing edge too, instead of pinning to the right.

That geometry moved out of the hook into three new pure exports on `rn-motion-ui/table-utils` — `columnBoundaries`, `dropIndexAt`, `dropIndicatorX` — so the same drop-target maths a custom header needs is available without reimplementing it, and is unit-testable without a gesture.

No breaking changes: every new prop is optional and the defaults preserve current behaviour.
