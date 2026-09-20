---
'rn-motion-ui': patch
---

Carry HoldMenu's internal context on the teleported node itself, so a provider unmounting can no longer crash the host's render.

On Android with a `BlurProvider`, the overlay (backdrop + menu + twins) is teleported out of the `BlurTarget` into the overlay host, which renders it outside the provider's React tree. React context does not cross that boundary on its own — it belongs to where a node is *rendered*, not where it was created — so the teleported pieces read the provider's shared values from a module-level mirror instead. That mirror's lifetime was not the entries': `HoldMenuProvider` cleared it in its unmount effect regardless of who else depended on the slot, and `OverlayHost` rendered every still-registered entry verbatim. A provider unmounting while an entry it had registered was still in the host (a closed tab's pane, in the reported case) left that entry rendering with `null` context, and `useHoldMenuInternal` threw "HoldMenu components must be used within a `<HoldMenuProvider>`" — uncaught under the root, so on Android it killed the process, taking the JS surface down with it and surfacing in Detox only as "The specified child already has a parent".

The value now travels with the node: `HoldMenuOverlayPortal` is the single component every hold-menu teleport goes through, and it wraps what it hands the host in the provider's own value, read in-tree where that context still reaches it. Nothing reads a module-level slot any more, so an entry cannot outlive its own context — a stale entry renders (and is dropped on the next flush) instead of throwing, which is also what makes two live providers safe: each keeps its own value, and the last one to mount no longer decides what the others' overlays see.

No visual or API change; `useHoldMenuInternal` still throws for content genuinely rendered outside a `HoldMenuProvider`.
