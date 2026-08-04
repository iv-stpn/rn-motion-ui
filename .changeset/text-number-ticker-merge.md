---
"rn-motion-ui": major
---

**Breaking:** `AnimatedNumber` and `NumberTicker` are merged into a single `TextNumberTicker`, exported from `rn-motion-ui/text-number-ticker`. The `/animated-number` and `/number-ticker` subpaths are gone.

The two components animated the same thing two ways: `NumberTicker` rolled a column per digit, `AnimatedNumber` counted one label up to the value. That is now the `mode` prop — `'roll'` (default) and `'count'`:

```tsx
// Before
<NumberTicker value={48273} locale={true} stagger={0.04} />
<AnimatedNumber value={129480} duration={1.2} />

// After
<TextNumberTicker value={48273} locale={true} stagger={0.04} />
<TextNumberTicker mode="count" value={129480} duration={1.2} />
```

`duration` keeps each component's old default per mode (0.9s per digit in `'roll'`, 1.2s total in `'count'`), so neither migration changes timing.

Props that were only on one of the two now apply to both where it makes sense: `'count'` gained `pad`, `locale`, `prefix` and `suffix`, and `'roll'` gained `format`. `stagger` and `digitClassName` stay `'roll'`-only. A custom `format` in `'count'` receives the in-flight fractional value and owns its rounding, which is what lets a compact formatter stay legible mid-count; without one the value is rounded before formatting.

`NumberTicker`'s `blur` prop is dropped rather than carried over. It was accepted for web API parity and documented as having no visual effect on React Native, so nothing rendered differently for it.
