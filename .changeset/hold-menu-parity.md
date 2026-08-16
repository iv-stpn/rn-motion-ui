---
'rn-motion-ui': patch
---

fix(ui): hold-menu parity — always-open-below placement with up-travel, flicker-free lift handover, iOS expo-blur scrim

- **Placement**: `HoldContextMenu` now defaults `side` to `'bottom'`, matching
  react-native-hold-menu: the menu always opens below the held item, and when
  it would overflow the bottom of the screen the item and the menu travel up
  together (a negative `shift`) until the menu fits — the panel may still
  scroll if the item's travel is exhausted. The previous default `'auto'`
  (flip above when there is more room there) remains available and unchanged
  for consumers who pass it explicitly.
- **Lift handover**: the trigger no longer hides on `open`. It hides only once
  the lifted copy has actually mounted — the overlay fires `onLiftReady` from
  the copy's subtree, and the trigger keeps the `HANDOVER_DELAY` beat so both
  are visible at the same pixels before the original fades. This closes the
  frame gap between the trigger hiding and the copy mounting (the copy renders
  only after `measureInWindow` lands, a frame or two after open on Android),
  which read as the item vanishing and remounting. Web never fires the signal
  and never hides the trigger.
- **Scrim blur**: on iOS the scrim now renders an expo-blur `BlurView` at full
  intensity under the translucent dark `Pressable` (upstream's
  blur-under-dim backdrop), via a new internal `hold-scrim-blur.native`
  module that loads `expo-blur` with a guarded dynamic require — an optional
  peer, so consumers without it get the plain translucent scrim, and web keeps
  its CSS `backdrop-blur-xs`. Android keeps the dim alone.
