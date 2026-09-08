---
'rn-motion-ui': minor
---

feat(Toaster): add a cross-platform toast component

Adds a new `rn-motion-ui/toaster` subpath exposing `<Toaster />` and a callable
`toast` API (`toast.success`, `toast.error`, `toast.warning`, `toast.info`,
`toast.dismiss`).

- **Web** delegates to Sonner (`sonner` is now a dependency), mapping the shared
  contract onto its API — `position: 'top' | 'bottom'` becomes its centred corners,
  `duration: 0` (sticky) becomes `Infinity`, and `action.onPress`/`onClose` bridge
  to `action.onClick`/`onDismiss`. Toasts default to **top-centre** on web and
  shrink to their content (capped at a readable `max-width`), with their surface,
  text, border and status colours drawn from the theme tokens.
- **Native** renders a custom Reanimated toast (inspired by
  expo-animated-toast): a module-level store drives `useSyncExternalStore`, and each
  toast slides in from its edge through `AnimatePresence` with a status dot, optional
  description and action, tap-to-dismiss, and auto-dismiss via a timer. Toasts
  default to **bottom-centre**, sit at a compact mobile size, and honour a `glass`
  prop that swaps the opaque surface for a frosted `Surface` (backdrop blur + specular
  rim).
