---
'rn-motion-ui': patch
---

Rework the `Toaster`: drop the border, match Button colours, and add default status icons.

The toast pill loses its hairline border and gains a `variant` prop that fills it with the Button family's palette (`primary` / `secondary` / `accent` / `neutral` / `danger` / `success` / `warning` / `info`), with the text taking the fill's legible foreground. `toast.error` now maps to `danger` (the Button rename).

Semantic variants render a default status glyph — a filled check for `success`, a filled close for `danger`, a warning triangle, and an info mark — coloured to the pill in both solid and frosted modes.

A new `pill` option (and `<Toaster pill>`) renders the toast as a fully-rounded capsule; the toast padding is tightened, the status icon is enlarged, and the icon-to-text gap is reduced. A `size` option (and `<Toaster size>`) selects `sm` / `md` / `lg` — compact, default and roomy toasts.
