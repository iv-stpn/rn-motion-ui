---
"rn-motion-ui": minor
---

**Menu motion is now one definition, and it is yours to retune.** Every panel a
trigger summons — `AdaptiveDropdown`, `HoverMenu`, `Popover`, `HoldContextMenu` —
had drifted onto its own spring, its own exit and its own idea of whether to scale
or slide. Four menus, four entrances. They now share one: a fade up from `0.96`
with an 8px travel toward the trigger, growing out of the corner facing it, and a
200ms ease-in on the way out.

Each of the four takes a `motion` prop to change that:

```tsx
import { HoverMenu } from 'rn-motion-ui/hover-menu';

// Slower, softer, and further.
<HoverMenu motion={{ enter: { type: 'spring', stiffness: 140, damping: 22 }, offset: 16 }} items={items}>
  <Button>Insert</Button>
</HoverMenu>

// No movement at all — just the fade.
<Popover motion={{ offset: 0, scale: 1 }}>…</Popover>
```

`enter` and `exit` are `Partial<MotiTransitionProp>`, merged over the preset the
same way `Button`, `Tabs`, `Switch`, `Radio` and `Checkbox` already take theirs, so
a partial override changes only what it names. `scale: 1` drops the scale and
`offset: 0` drops the slide. `HoldContextMenu` adds `scrim` and `lift` for the two
surfaces only it has. `useReducedMotion` overrides all of it — a `motion` prop
cannot animate a menu for someone who asked the OS for less.

`rn-motion-ui/theme/motion` exports what the four run on, for anyone matching a
custom overlay to them: `resolveMenuMotion` returns the whole
`from`/`animate`/`exit`/`transition` set for a side, `menuTransformOrigin` gives
the corner a panel should grow from for a side/align pair, and
`MENU_ENTER_SCALE` / `MENU_ENTER_OFFSET` / `MENU_EXIT_TRANSITION` /
`MENU_SCRIM_TRANSITION` are the tokens behind the defaults.

Visible changes from this: `AdaptiveDropdown`, `HoverMenu` and `Popover` now scale
slightly as they open rather than only sliding, and all three grow from the corner
nearest their trigger instead of their centre. `HoverMenu`'s exit goes 180ms →
200ms.
