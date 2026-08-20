---
'rn-motion-ui': patch
---

fix(HoldMenu): keep the panel on screen in nested scrolls and lift it above the screen bottom

The centre-anchored panel's pop-in transform composes to a net +itemWidth
offset that the viewport clamp ignored — a full-width row (the nested-scroll
cards, the Home example rows) shoved the panel a whole row-width past the right
edge. The clamp now runs on the panel's visual position (left + net offset) and
the offset is backed back out of the style, so a centre-anchored panel stays
inside the viewport.

The travel clamp also now uses the provider root's VISIBLE extent (its measured
height capped to the window's bottom edge relative to the root's top) instead
of its full layout height — when the provider sits inside a scrollable
container (native storybook wraps every story in a ScrollView; a scrolling app
screen), the root's height is the whole content height and the menu never
lifted, running off the bottom of the screen. A row held near the lower edge
now lifts the menu above the screen bottom as the NestedScroll story showcases.
The story gained a `play` fn (web `'hold'` = DOM `contextmenu`, so it works
synthetically) pinning both behaviours, and the panel/backdrop got testIDs.
