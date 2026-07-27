---
"rn-motion-ui": minor
---

`Tabs` gains a choice of content-panel animation. `contentAnimation` on `Tabs` sets it for every panel, and `animation` on a single `TabsContent` overrides it for that panel only:

- `fade` (default) — the existing cross-fade with a 4 px settle, unchanged, so nothing shifts for current consumers.
- `slide` — the panel you land on travels a full container width in from the side the selection moved towards, while the panel you left is pushed out the opposite way, so the pair reads as one page displacing another rather than as a nudge. Sized for mobile screens and modals. Direction is read off the triggers' measured rects rather than the order the panels were declared in, so it also holds for controlled changes: a programmatic jump to a tab slides the same way a press on that tab would. Travel distance is measured on the `Tabs` root, so the first panel — which has no previous page to push out — just fades in.
- `dropIn` — the panel falls from above on a springy scale-up.

`fade` and `dropIn` are enter-only: `TabsContent` renders nothing for the tab it isn't showing, so a switch is an unmount plus a fresh mount, with no exiting layer to co-ordinate. `slide` is the exception, since a page swap only reads as one if the page you left is visibly pushed aside. The outgoing panel keeps its subtree mounted for the length of the push, leaves the layout flow immediately so it can't displace the panel replacing it, and finishes the trip as an absolutely positioned layer over the spot it held — hidden from assistive tech and non-interactive while it travels, then unmounted. Under `prefers-reduced-motion` every animation collapses to the same plain opacity fade with no exit layer at all — the cross-fade is information, the transforms are decoration.

A full-width slide has to be clipped or the travelling pages paint outside the `Tabs` box, so `slide` panels mount inside an `overflow: hidden` wrapper. The clip is scoped to the motion: an arriving panel lifts it once it has landed, which keeps shadows and any overlay a panel raises inline from being cut off for the rest of the panel's life, and a departing panel simply stays clipped until it unmounts.

`contentTransition` is the matching escape hatch, partial like `indicatorTransition`: pass only the fields you want changed and the rest come from that animation's default (180 ms timing for `fade`, 280 ms linear for `slide`, a spring for `dropIn`).

Story: the playground gains a Content animation chip row wired to the live controlled set, a section with one tab set per animation for clicking through them side by side, and a modal-width sample where the full-width slide reads properly. `Demo: Slide (both directions)` tours forward and back at that width.
