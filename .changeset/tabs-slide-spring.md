---
'rn-motion-ui': patch
---

fix(Tabs): slide panels on `MultiStepMenu`'s spring instead of a linear tween

`contentAnimation="slide"` pushed its two panels with `{ type: 'timing', duration:
280, easing: linear }`. The constant rate was chosen to read as one strip of pages
moving past a window, but it starts and stops dead, which is not how any other
travelling surface in the library moves — `MultiStepMenu`, whose pane slide is the
same gesture, glides on a lightly-damped spring with a hair of settle at the end.

`slide` now shares that spring (`stiffness 280, damping 30, mass 1`), with `opacity`
kept as a 280 ms ease-out so the first panel's mount fade can't overshoot past 1.
Both halves of a push still read the one transition, so they stay in lockstep.

The hold that keeps the outgoing panel mounted — and the clip on the entering one —
is derived from the spring rather than falling to the flat 600 ms bucket for
anything that isn't a timing config: a spring is within a pixel of its target after
`12·mass/damping` seconds, so the default settles in 460 ms instead of being held
660 ms. That matters because the same timer releases the entering panel's
`overflow: hidden`, and a clip outliving the motion cuts the shadow of a panel that
has visibly stopped.

`contentTransition` overrides still apply. One thing to note if you passed a bare
`{ duration: n }`: it now merges onto a spring, so it reads as Reanimated's
duration-based spring rather than as a tween. Pass `{ type: 'timing', duration: n }`
for the old behaviour.
