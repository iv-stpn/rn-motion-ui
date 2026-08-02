---
"rn-motion-ui": minor
---

**HoldContextMenu**: new component — an action menu that reads as the platform's
own. On iOS and Android, hold an item: it lifts off the page, the rest of the
screen dims, and an iOS-style panel grows out of the corner nearest it, both
travelling together so the pair stays on screen. On web it is a right-click, and
what opens is a plain dropdown anchored to the item — no hold, no lift, no dim.
A mouse already has a button for this, and once the gesture is a click there is
no press to animate and nothing to lift out from under a finger. One component,
two honest presentations; `activateOn="tap"` and `"double-tap"` read the same
either way, and get the dropdown on web too.

A port of [react-native-hold-menu](https://github.com/enesozturk/react-native-hold-menu)
(MIT, Enes Öztürk) onto this package's primitives. Same interaction, none of the
upstream dependencies: no `@gorhom/portal`, `expo-blur`, `expo-haptics`, `nanoid`,
`lodash.isequal` or `react-native-gesture-handler`.

```tsx
import { HoldContextMenu } from 'rn-motion-ui/hold-context-menu';

<HoldContextMenu
  items={[
    { id: 'reply', label: 'Reply', icon: MessageCircle, onPress: () => reply(message.id) },
    { id: 'copy', label: 'Copy', icon: Copy, onPress: () => copy(message.body), separator: true },
    { id: 'delete', label: 'Delete', icon: Trash2, destructive: true, onPress: () => remove(message.id) },
  ]}
>
  <MessageBubble message={message} />
</HoldContextMenu>
```

Coming from upstream:

| Upstream | Here |
| --- | --- |
| `<HoldMenuProvider>` at app root + portal host | nothing — each menu owns a `Modal` through `OverlayShell` |
| `expo-blur` scrim | native dims and blurs with `backdrop-blur-xs`; web paints nothing, since a dropdown does not dim the page |
| `hapticFeedback="Medium"` (`expo-haptics` style name) | `haptics` — `true` buzzes on Android, or pass your own function |
| `items[].text` / `isTitle` / `isDestructive` / `withSeparator` | `items[].label` / `heading` / `destructive` / `separator`, plus `id` and `disabled` |
| `actionParams` map keyed by label | close over what you need in the item's `onPress` |
| `bottom` + `menuAnchorPosition` | `side` + `align`, matching `Popover` and `AdaptiveDropdown` |
| `theme="light" \| "dark"` | theme tokens — follows the active scheme on its own |
| menu width fixed at 60% of the screen | `menuWidth`, default 240, clamped to the viewport |
| `closeOnTap` defaults to `false` | defaults to `true`, the iOS behaviour — native-only, as nothing lifts on web to tap |
| panel scales out of the corner from `0.6`, lift on a spring of its own | the shared anchored-menu motion — scale from `0.96` with an 8px slide toward the trigger, lift on the panel's own transition so the two move as one thing. `motion={{ scale: 0.6, offset: 0 }}` restores upstream's entrance |

Beyond the port: the right-click that opens the menu on web (`openOnContextMenu`,
on by default) is also the keyboard path — browsers raise `contextmenu` for
Shift+F10 and the ContextMenu key on the focused trigger, so the panel is
reachable without the pointer a hold gesture requires. Enter and Space are left
alone there, so they still reach whatever you nest inside the trigger. On native,
screen readers open it through a `longpress` accessibility action. Rows are
`menuitem`s, a `heading` row is `presentation`, a disabled row carries
`aria-disabled`, and the scrim is a named button rather than a bare tap target.
`useReducedMotion` swaps every spring for a short fade.

Panel placement is measured per-open from `useWindowDimensions` and the safe-area
insets, not from module-level `Dimensions` constants read at import time, so it
survives a rotation. The height estimate the layout runs on is corrected from the
panel's real `onLayout` height, so a row that wrapped under a large accessibility
font still gets a panel that fits.

The panel opens on the same motion as every other menu a trigger summons, and
`motion` retunes it — `enter`, `exit`, `scale` and `offset` shared with
`AdaptiveDropdown`, `HoverMenu` and `Popover`, plus `scrim` and `lift` for the two
surfaces only this menu has. `useReducedMotion` still wins over all of it.

```tsx
// Upstream's entrance, for anyone who ported from it and wants the old feel back.
<HoldContextMenu motion={{ offset: 0, scale: 0.6 }} items={items}>
  <MessageBubble message={message} />
</HoldContextMenu>
```
