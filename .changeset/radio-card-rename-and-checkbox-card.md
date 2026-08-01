---
"rn-motion-ui": minor
---

`CardChoice` → `RadioCard`, now animating per card, plus a new multi-select `CheckboxCard`

**Breaking:** `CardChoice` has been renamed to `RadioCard` to say what it is — a
card-shaped radio — and to pair with the new `CheckboxCard`. The subpath moved
with it; there are no deprecated aliases.

| Old | New |
|-----|-----|
| `rn-motion-ui/card-choice` | `rn-motion-ui/radio-card` |
| `CardChoice` | `RadioCard` |
| `CardChoiceGroup` | `RadioCardGroup` |
| `CardChoiceGroupProps` | `RadioCardGroupProps` |
| `CardChoiceProps` | `RadioCardProps` |

The default group `testID` prefix follows the rename: `card-choice-group` →
`radio-card-group`, so derived ids become `radio-card-group-card-<value>`,
`-ring`, `-dot` and `-badge`.

```tsx
// Before
import { CardChoice, CardChoiceGroup } from 'rn-motion-ui/card-choice';
<CardChoiceGroup value={plan} onValueChange={setPlan}>
  <CardChoice value="monthly" title="Monthly" subtitle="$12/mo" />
</CardChoiceGroup>

// After
import { RadioCard, RadioCardGroup } from 'rn-motion-ui/radio-card';
<RadioCardGroup value={plan} onValueChange={setPlan}>
  <RadioCard value="monthly" title="Monthly" subtitle="$12/mo" />
</RadioCardGroup>
```

**Breaking: the shared gliding dot is gone.** `RadioCardGroup` used to render a
single dot that measured each card's radio ring (`measureInWindow`) and glided
between them. Selection now animates per card instead: the ring's border and the
card's border cross-fade between `border` and `info`, the background tint
cross-fades in the same pass, and the dot fades and scales in place. No geometry
is measured, so selection no longer depends on layout settling.

What changes for callers:

- **The selected accent is `info`, not `primary`.** The ring border, dot, card
  border and background tint all resolve from `--color-info`, so selection reads
  as state rather than as the page's brand action colour. The dot also grew from
  10 px to 14 px inside the 20 px ring. The `badge` pill is unaffected — it stays
  `primary`, since it labels the offer, not the selection.
- **`radio-card-group-indicator` no longer exists.** Each selected card renders
  its own dot at `<card testID>-dot`. Previously that id only appeared on
  standalone cards; inside a group it is now present too.
- **`transition` retimes the cross-fade, not a glide.** The default moved from
  `MOTION_SNAPPY` (a spring, appropriate for travel) to `TIMING_FAST` (150 ms
  timing, appropriate for a fade). A spring is still accepted.
- **`RadioCard` takes its own `transition`**, overriding the group's — the same
  group-cascades-to-card shape `CheckboxCard` uses for `checkTransition`.
- **`className` and `style` now target the animated card surface**, the bordered
  padded box inside the pressable. A `Pressable` can't be animated directly, so
  the border and tint live on a `MotiView` inside it and the pressable keeps only
  `flex-1`. Visual overrides (padding, radius, border) behave as before; an
  override of the card's *outer* footprint (e.g. a fixed `width`) now sizes the
  surface within `flex-1` rather than the pressable itself. Wrap the card to
  control its outer box.

**Fixed:** `RadioCard` now sets `aria-checked` directly instead of
`accessibilityState={{ checked }}`, which react-native-web does not forward — the
selected state never reached the DOM on web, so screen readers announced every
card as unchecked. Matches `Radio` and `Checkbox`. `RadioCard` also gained an
`accessibilityLabel` prop, defaulting to `title`, so a card answers with its own
name rather than its concatenated text content.

**New: `rn-motion-ui/checkbox-card`** — exports `CheckboxCard` and
`CheckboxCardGroup`, the multi-select counterpart to `RadioCard`. Same card
anatomy (title, subtitle, badge, `numeric` subtitle, custom children), with
`Checkbox`'s animated box in place of the radio ring: the `info` fill and the
check mark cross-fade on toggle and the box springs down on press. Selection uses
the same `info` accent as `RadioCard`, so the two read as one family.

Because any number of cards can be checked at once, `CheckboxCardGroup` owns only
the selected-value array. It takes `role="group"`; each card answers
`accessibilityRole="checkbox"` with `aria-checked` / `aria-disabled`.

Props follow the heroui-native names already used by `Switch` — `isSelected`,
`onSelectedChange`, `isDisabled`. Group-level `isDisabled` and `checkTransition`
cascade to every card, and a card can override either.

```tsx
import { CheckboxCard, CheckboxCardGroup } from 'rn-motion-ui/checkbox-card';

// Grouped — the group owns the selected array
const [addons, setAddons] = useState<string[]>(['support']);
<CheckboxCardGroup value={addons} onValueChange={setAddons}>
  <CheckboxCard value="seats" title="Extra seats" subtitle="$4/mo each" numeric />
  <CheckboxCard value="support" title="Priority support" subtitle="$29/mo" badge="Popular" numeric />
</CheckboxCardGroup>

// Standalone — the card is driven directly
<CheckboxCard isSelected={on} onSelectedChange={setOn} title="Audit log" subtitle="$12/mo" />
```

New types: `CheckboxCardProps`, `CheckboxCardGroupProps`.
