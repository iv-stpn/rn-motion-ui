---
'rn-motion-ui': patch
---

fix(ui): hold-menu — web stories fill the page, web backdrop blurs like upstream

- **Story container**: the HoldMenu stories now render inside a story-level
  decorator whose wrapper view carries `minHeight: calc(100vh - 3rem)` (the
  global theme decorator pads 1.5rem per side), giving the provider's flex-1
  gesture root a definite height. The demo fills the visible page instead of
  a small box at the top-left, the list grows to fill the remaining height
  and scrolls, and the picked-note stays pinned at the bottom — so the
  full-bleed backdrop dims the whole page, not just the story box.
- **Web backdrop**: web now joins the blur-capable tier. The backdrop and
  panel switch from the near-opaque Android dim to the translucent values
  (`rgba(0,0,0,0.2)` light / `rgba(0,0,0,0.75)` dark), and the web blur twin
  (`hold-menu-blur.tsx`) frosts the layer with CSS `backdrop-filter:
  blur(20px)` — the equivalent of upstream's expo-blur `BlurView` behind the
  tint. Android keeps the plain near-opaque dim, exactly as upstream.
