---
"rn-motion-ui": minor
---

`Switch`: reduced motion cuts the thumb, and a tighter label gap

**Reduced motion now wins over `thumbTransition`.** When the OS asks for reduced
motion, the thumb cuts straight to its position (`TIMING_INSTANT`) instead of
springing, matching how every other animated control in the library treats the
setting. Previously the spring ran regardless, and a caller-supplied
`thumbTransition` was merged in even under reduced motion — now it is ignored in
that case. With reduced motion off, `thumbTransition` merges over the default
spring exactly as before.

**The gap between the track and the label shrinks from 12px to 8px**, and is now
set by a `gap-2` class on the root rather than an inline `style`. Rows of
switches read slightly tighter; pass a `style` to set your own spacing.
