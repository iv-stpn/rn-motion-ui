# Contributing to rn-motion-ui

> This file currently covers **accessibility conventions** and **releases**. The
> full new-component checklist (stories, testIDs, tokens, exports) is tracked
> separately in `.agent/IMPROVEMENT_PLAN.md` §3.1 and will land here.

## Releases

Two packages publish to npm, and both are versioned by
[changesets](https://github.com/changesets/changesets):

| Package | Directory |
| --- | --- |
| `rn-motion-ui` | `packages/ui` |
| `rn-motion-ui-icons` | `packages/icons` |

Any change to either one needs a changeset — `bun changeset`, pick the packages,
pick a bump. A change to `packages/icons` is not covered by a `rn-motion-ui`
changeset: they version independently.

Everything after that is automatic. Pushing to `main` runs the Release workflow,
which opens a "chore: version packages" PR; merging that PR publishes whatever
the changesets described. Nothing is published from a laptop.

### Never use `workspace:` for a dependency that ships

`rn-motion-ui` depends on `rn-motion-ui-icons`, and that range must be plain
semver (`^0.1.0`), **not** `workspace:*`.

Changesets deliberately leaves `workspace:` ranges alone, and `changeset publish`
shells out to `npm publish`, which does not substitute them either. A
`workspace:*` range therefore reaches the registry verbatim, and every consumer
install fails with `EUNSUPPORTEDPROTOCOL Unsupported URL Type "workspace:"`.

A plain range costs nothing locally — bun still links the workspace copy — and
changesets rewrites it when the version moves out of range.

### Why `onlyUpdatePeerDependentsWhenOutOfRange` is set

`rn-motion-ui-icons` peer-depends on `rn-motion-ui` (icons read their default
colour from its theme layer). By default, changesets force-majors every
**peer**-dependent whenever a package takes a non-patch bump — so a routine
`rn-motion-ui` feature release would have majored the icon package too, with no
icon changed.

`.changeset/config.json` opts out:

```json
"___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH": {
  "onlyUpdatePeerDependentsWhenOutOfRange": true
}
```

Now icons only majors when a `rn-motion-ui` release actually leaves its declared
peer range (`^4.0.0`) — i.e. at `rn-motion-ui@5`, when the compatibility claim
genuinely expires. The option name warns it may change in a patch release; if a
changesets upgrade ever drops it, expect the phantom majors to return.

### The icon package is dual-licensed

`rn-motion-ui-icons` declares `(MIT AND Apache-2.0)`: the wrapper components and
`IconProps` are ours under MIT (`LICENSE`), the glyph geometry is MingCute's
under Apache-2.0 (`LICENSE-APACHE`), and `NOTICE` carries the attribution
Apache-2.0 §4 requires. All three ship in the tarball.

If you ever bump `@iconify-json/mingcute` and regenerate, re-check that upstream
is still Apache-2.0 — if MingCute relicenses, both the SPDX expression and
`NOTICE` have to follow. `rn-motion-ui` itself stays plain MIT: it contains no
MingCute artwork, only imports from the icon package.

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
| `Draggable` | A grab handle around a child. The child is the control and carries the role and name; a role on the wrapper would announce the grip instead of the thing gripped. Its `ViewProps` a11y props forward for the case where the wrapper *is* the control. A drag is pointer-only on both platforms, so it carries a consumer obligation: every `Draggable` needs a second, non-pointer path to the same outcome — see its JSDoc. |

If you exempt a new component, add a row here with the reason. "Nothing to
announce" is a reason; "did not get to it" is not.

### Testing

The a11y contract is asserted in the component's story `play` function, not
just eyeballed — roles and names are queryable (`findByRole`, `findByLabelText`)
and regress silently otherwise.
