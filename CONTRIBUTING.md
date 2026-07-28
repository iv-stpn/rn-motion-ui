# Contributing to rn-motion-ui

> This file currently covers **accessibility conventions** only. The full
> new-component checklist (stories, testIDs, tokens, exports, changesets) is
> tracked separately in `.agent/IMPROVEMENT_PLAN.md` §3.1 and will land here.

## Accessibility

Every component either carries accessibility semantics or is on the exemption
list below. There is no third option: a component with no roles and no written
exemption is a gap, and the next audit will re-open it.

### What a component owes

- **Interactive** — a role (`button`, `switch`, `tab`, `adjustable`, …), an
  accessible name, and state (`accessibilityState`, `aria-expanded`,
  `aria-disabled`) that tracks the visual state.
- **Value-bearing** — `accessibilityValue` with `min`/`max`/`now`, plus `text`
  when a bare number would not mean anything out loud.
- **Modal** — `role="dialog"`, `aria-modal`, `accessibilityViewIsModal`, an
  accessible name, a dismiss control reachable *without a pointer*, and
  `useFocusTrap` for web focus containment (native gets it from `Modal`).
- **Announcing a change the user did not directly cause** — a persistent live
  region (`accessibilityLiveRegion` + `aria-live`) that outlives the content
  swapping inside it. On iOS add an explicit
  `AccessibilityInfo.announceForAccessibility`: `accessibilityLiveRegion` is
  Android-only and VoiceOver does not re-read a mutated subtree.
- **Decorative** — actively hidden, with all three of `aria-hidden` (web),
  `accessibilityElementsHidden` (iOS) and
  `importantForAccessibility="no-hide-descendants"` (Android). `aria-hidden`
  alone leaves the content fully audible on both native platforms.

### Presentational exemptions

These components add no semantics of their own **by design**. They are
containers, and the roles belong to whatever a consumer renders inside them.
Adding a role here would be worse than adding nothing: it would describe the
wrapper instead of the content.

| Component | Why it is exempt |
| --- | --- |
| `Card` | A styled box — surface, padding, elevation. Its children carry the meaning; a `Card` that announced itself would sit between the reader and them. |
| `Text` | Maps typography props to utility classes over RN's own `Text`, which already exposes text semantics. Consumers pass `accessibilityRole="header"` where a heading is meant. |
| `Overlay` (`overlay-shell`, `use-sheet-presence`) | Infrastructure behind the sheet family. `OverlayShell` *does* own the modal semantics for its consumers — it is exempt from having its own on top of that. |
| `ScrollReveal` | An animated wrapper that fades and slides its child on scroll. Purely visual; the child is untouched and always present in the tree. |
| `SmoothScroll` | A `ScrollView` that publishes its scroll state. Scroll containers already have platform semantics. |
| `AnimatedList` | Layout and enter/exit animation only. It does carry documented obligations for the *consumer* around focus and announcements — see its JSDoc. |

If you exempt a new component, add a row here with the reason. "Nothing to
announce" is a reason; "did not get to it" is not.

### Testing

The a11y contract is asserted in the component's story `play` function, not
just eyeballed — roles and names are queryable (`findByRole`, `findByLabelText`)
and regress silently otherwise.
