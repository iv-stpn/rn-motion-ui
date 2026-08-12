---
"rn-motion-ui": patch
---

**Press timeline: make the phase state machine explicit**

The transitions between a press's phases — how it moves through `pending`, `active`, `hold`, `drag`, and `idle` — were previously spread across the timer callbacks in `usePressTimeline`, with a free-floating `heldRef` boolean jointly encoding whether the press had reached hold. That logic now lives in a pure `transition` function in `press-timeline.ts`, next to `readPressMove`, modeled as a single `{ phase, hasHeld }` state object.

No behaviour change: the hook still drives the same phases and callbacks through its stable imperative `timeline` object. The move makes the transition rules unit-testable (the one half of the timeline that previously wasn't) and states the `hasHeld` contract once — `end` keeps it, `lift` consumes it, a new `press` resets it — instead of implying it across three separate ref writes.
