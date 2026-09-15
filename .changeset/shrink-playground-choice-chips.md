---
'rn-motion-ui': patch
---

Shrink the storybook playground's choice chips

The shared story harness rendered its `Choice` control (Kind/Size/Shape, mode
pickers, and the rest of the playground chrome) at `size="sm"`; it now uses
`size="xs"`, so the chips sit at 24px with `text-xs` labels and a 4px gap
instead of 36px / `text-sm` / 8px.

Storybook chrome only — `src/**/__stories__/**` is excluded from the published
package, so nothing in the shipped library changes.
