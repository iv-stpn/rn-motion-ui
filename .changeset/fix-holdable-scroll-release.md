---
"rn-motion-ui": patch
---

**Holdable: release the pan so an enclosing scroll view still scrolls**

- The native hold gesture now calls `manager.fail()` when the finger moves before the hold fires, and again when it lifts. A pan left in BEGAN kept its claim on the finger and blocked the enclosing `ScrollView`/`FlatList` — which is why the mobile file-system views scrolled on web but not on device.
