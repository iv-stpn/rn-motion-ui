---
"rn-motion-ui": minor
---

Add the `special` and `inverse` variants to `Button` and `ElevatedButton`, so all three button families now cover the same palette as `GlossyButton`. `special` fills with the non-semantic `special` token — for promotions and upgrade paths, where `info`/`success`/`warning`/`danger` each carry a meaning. `inverse` fills with `foreground` and punches its label through to `surface-1`: deliberately not `primary`, which is the consumer's brand token and designed to be overridden, so a fill built on it can't promise contrast. Untinted the two land in the same place; they diverge the moment a consumer sets a brand hue.

Both variants get each component's full treatment — on `ElevatedButton` that means the gloss, rim highlight and coloured drop-shadow ring, with `inverse` casting the fixed dark-neutral drop that `neutral` already used rather than a tint of its own fill (darkening a near-white dark-mode fill would put a pale grey haze under the chip instead of a shadow). `StatefulButton` carries both through to its elevated chip, so `variant="special"` with `elevated` now renders the violet chip in idle/loading instead of collapsing to `neutral`. `Button`'s ripple polarity also now treats every opaque fill as filled — `danger`, `special` and `inverse` previously got the dark shimmer meant for transparent and light-plate variants.
