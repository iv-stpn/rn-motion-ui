---
'rn-motion-ui': patch
---

fix(MorphingFAB): anchor the native size morph on the trigger's corner

The root view resized with the shell (48×48 closed → 300×230 open), so on
Fabric the shell's layout transition ran against a root whose top-left jumped
to the expanded pane's top-left at open. The frame change (0,0,48,48) →
(0,0,300,230) is a pure top-left-anchored scale, so the pane appeared to grow
from its top-left corner instead of unfolding from the trigger, and collapsed
inverted on close. The root now keeps the full expanded size in both states;
the shell is anchored right/bottom inside it, so the transition's frames share
the pinned bottom corner and the pane unfolds up-left from the trigger on
every platform. Web is unaffected — it already animates width/height with
right/bottom anchoring.

On-device follow-up: inside the Android `BlurTarget`/ScrollView tree the
shell's layout transition still captured a stale start frame (the pane kept
growing from its top-left) even with the fixed root, while the SAME geometry
rendered through the `OverlayHost` portal morphed correctly. MorphingFAB now
renders through the overlay host on Android whenever a `BlurProvider` host
exists — for every `overlay` value, not just `"blur"` — and re-measures the
shell's anchor on every open so a FAB that scrolled while closed still opens
where its trigger is. Consumers without a provider keep the inline path
unchanged.
