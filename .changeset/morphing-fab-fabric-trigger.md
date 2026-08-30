---
'rn-motion-ui': patch
---

fix(MorphingFAB): size the root view so the trigger mounts on Android (Fabric)

The collapsed trigger was anchored to a zero-size, absolutely-positioned parent
via a negative offset, which Paper renders but Fabric drops — so `triggerTestID`
never appeared in the Android view/accessibility tree. The root now carries the
shell's real size (`TRIGGER_SIZE` collapsed, `expandedWidth`×`expandedHeight`
open) so the shell's corner anchor resolves to a non-negative offset.
