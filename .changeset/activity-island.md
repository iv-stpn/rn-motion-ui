---
'rn-motion-ui': minor
---

Add `ActivityIsland` — a full-screen shell with an activity bar above everything in it.

`DynamicIsland` is the pill form: it grows out of a notch. This is the bar form. `ActivityIsland` wraps the whole screen (`children`) and renders a black slab flush against the top edge. Raising an activity unrolls that slab, pushing the screen down by exactly what the bar gained — nothing is ever covered, so the screen keeps its scroll position and stays fully interactive while an activity runs.

```tsx
<ActivityIsland state={activity} idle={<TopBar />} testID="island">
  <DownloadsScreen />
  <ActivityIslandState id="upload" icon={Upload} title="Uploading 3 files" detail="47% · 2.4 MB/s" tone="info" progress={0.47} />
  <ActivityIslandState id="call" icon={Phone} title="Saurabh" detail="Incoming call · mobile" tone="success" />
</ActivityIsland>
```

`ActivityIslandState` renders only while its `id` matches the shell's `state`; changing `state` rolls the outgoing content up and out while the incoming content rises into place, and eases the bar to the new height, so a state that adds a progress track grows the bar rather than snapping to it. Omit `idle` and the bar itself is unmounted while nothing is running, leaving the screen untouched. The bar paints above the screen (`z-50`) so its drop falls across the content it displaced.

The bar's fill is `bg-black` in both color schemes — it is the device-bezel surface, not a themed one — so its ink is white and the per-state accent comes from a new `tone` prop (`neutral` | `info` | `success` | `warning` | `danger`) rather than from the theme's foreground. `safeArea` (default `true`) pads the bar under the device's top inset; the entrance, the exit and the push are all reduced to a plain fade or a snap under `useReducedMotion()`.
