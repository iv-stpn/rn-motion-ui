---
"rn-motion-ui": minor
---

`Switch`: custom colour themes, defaulting to `info`

**New: `theme`.** The switch's three fills — the selected track, the unselected
track and the thumb — are now a theme rather than two hardcoded classes. Pass a
built-in name, or an object to override individual slots.

```tsx
<Switch isSelected={on} onSelectedChange={setOn} theme="success" />
```

Six built-ins, one per status token plus the monochrome `primary`: `info`
(default), `primary`, `success`, `warning`, `danger`, `special`. Each pairs a
vivid track with the thumb colour that stays legible on it — the status fills
take a `white` thumb, `primary` takes `primary-foreground` instead, because
`primary` is near-white in dark mode and a white thumb would vanish into it. The
grey off-track is shared by all six, so a row of mixed themes reads as one
family.

**Breaking: the default look changed.** The selected track was `bg-primary`
(near-black on light, near-white on dark) and the thumb was `surface-3`. The
default `info` theme makes the track the `info` blue and the thumb `white` in
both schemes, matching the accent `RadioCard` and `CheckboxCard` already use for
selection — selection reads as state rather than as the page's brand action
colour. The unselected track is unchanged (`muted-foreground` at 60%). Pass
`theme="primary"` for the previous appearance:

```tsx
// What theme="primary" restores — the previous default look
<Switch isSelected={on} onSelectedChange={setOn} theme="primary" />
```

**Custom themes.** An object overrides slots on top of `info`, so anything left
out keeps the default — `{ track: '#0ea5e9' }` still gets the grey off-track and
the white thumb. Each slot takes one of three things:

| Slot value | Resolves to |
|-----|-----|
| `'accent'` | the `--color-accent` token, so it follows light/dark and consumer `@theme` overrides |
| `'special/70'` | the same token re-alphaed to 70%, as Tailwind's slash modifier does |
| `'#0ea5e9'`, `'rgba(0,0,0,0.4)'` | itself — any literal CSS colour RN parses |

```tsx
// Tokens — tracks the theme
<Switch
  isSelected={on}
  onSelectedChange={setOn}
  theme={{ track: 'accent', trackOff: 'muted', thumb: 'accent-foreground' }}
/>

// A literal brand colour for the on-track, defaults for the rest
<Switch isSelected={on} onSelectedChange={setOn} theme={{ track: '#0ea5e9' }} />
```

Fills are set through `style` from resolved values rather than by a utility
class, because a slot accepts an arbitrary CSS colour, which no class can carry.
Token names still go through the theme bridge, so a themed slot follows
light/dark exactly as a class would.

**New testIDs.** The track and thumb now carry ids derived from the switch's own:
`<testID>-track` and `<testID>-thumb` (`switch-track` / `switch-thumb` by
default). Previously neither was addressable.

**`useSwitch()` gained two fields.** `colors` holds the active theme's three
fills resolved to concrete sRGB — `Switch.Thumb` paints `thumb`, and custom
content can read the track fills to match them. `testID` is the switch's
resolved id, which sub-components derive their own from.

New types: `SwitchThemeName`, `SwitchThemeColors`, `SwitchColor`, `SwitchColors`
— all exported from `rn-motion-ui/switch`.
