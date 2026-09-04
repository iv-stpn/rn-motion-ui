---
'rn-motion-ui': minor
---

feat(Overlay): real plain-blur backdrop for MODAL menus on Android

Modal menus (`overlay="blur"`) render their blur pane inside an RN `Modal`,
which on Android is a separate Dialog WINDOW. The blur peer
(`react-native-liquid-glassmorphism`) captures its own window, so the in-modal
pane could never reach the page behind — blur mode showed only the dim (or
nothing for scrims with `dimOnBlur={false}`). iOS and web were unaffected
(their modals present in the same window layer / in place).

- New export `rn-motion-ui/overlay/blur-host` — `<OverlayBlurHost />`, mounted
  ONCE at the app root (a full-bleed, touch-transparent sibling). While a modal
  menu in blur mode is open it paints one plain-blur pane (the peer's
  BlurView-style recipe — `rim`/`specular`/`thickness` off — NOT the liquid
  glass surface) in the APP window, where the capture reaches the page; the
  transparent modal above lets the frosted page show through around the panel.
  Android-only; renders nothing on iOS/web, below Android API 31, without the
  peer, or while no menu requests a blur.
- Modal-menu scrims (AdaptiveModal, BottomSheet, Drawer, Popover, HoverMenu,
  MorphingMenu, MorphingModal, ActionFeedbackModal, AdaptiveDropdown) now
  render `ModalBlur` instead of an in-modal blur pane: inline on iOS/web
  (unchanged behaviour), hosted on Android when `OverlayBlurHost` is mounted.
- Degradation: without the host, or below API 31 / without the peer, a
  requested blur falls back to the dim ALWAYS — including scrims that pass
  `dimOnBlur={false}` — so blur mode never renders nothing behind the panel.
- Inline scrims (HoldMenu backdrop, MorphingFAB/overlay menus, FileSystem
  background menu) are unchanged — they already blur in the app window.
