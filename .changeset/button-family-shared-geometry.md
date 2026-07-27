---
"rn-motion-ui": minor
---

One shared box for the whole button family, driven by tokens. `Button`, `ElevatedButton`, `GlossyButton` and `ActionSwapButton` had each grown their own height/padding/radius table, so an `md` of one type didn't line up with an `md` of another. They now all read the same geometry from `tokens.css` — `--spacing-button-{sm,md,lg}` (32/40/48px), `--spacing-button-pad-{sm,md,lg}` (12/16/20px) and `--radius-button-{sm,md,lg}` (8/10/12px) — so a row of mixed button types has one baseline, and overriding a token retunes every type at once.

`ActionSwapButton` joins the family properly: it takes a `shape` prop (`'pill' | 'rounded'`, default `'pill'` so existing buttons look the same), its `size` is now the family's `ButtonSize`, and its label uses the family's type ramp instead of a duplicate of it. `ActionSwapButtonSize` is now an alias of `ButtonSize` and `ActionSwapButtonShape` of `ButtonShape` — both still exported.

Visible changes, per type:

- **`Button`** — `md` and `lg` lose 4px of horizontal padding (20→16, 24→20); the `rounded` shape moves off a flat 12px radius onto the 8/10/12 ramp; `icon` grows from 32 to 40px so it squares the `md` height.
- **`ElevatedButton`** — padding grows 2–4px per size (10→12, 14→16, 16→20); `icon` grows from 32 to 40px. Radii are unchanged (AlignUI's 8/10/12 is what the shared ramp was drawn from), and its 14px label is still the documented opt-out from the type ramp.
- **`GlossyButton`** — `md` grows 36→40px and `lg` 44→48px to join the family's height ramp; padding drops at `md`/`lg` (20→16, 24→20) and grows at `sm` (10→12); `icon` grows 36→40px; the `rounded` shape moves off a flat 12px radius onto the ramp. The 2px inset around the label is gone, so a glossy label sits at the same inset as a flat one.
- **`ActionSwapButton`** — same height and padding as before at every size. Its content gap is now a flat 8px (was 6 at `sm` and 10 at `lg`).

Adornment spacing is one value across the family now (8px). `ElevatedButton` previously spaced its content at 12px and pulled icons back in by 4px, which netted the same 8px beside a label — the difference only showed with two adornments.

`StatefulButton`'s success/error padding squeeze is derived from the shared padding rather than tabulated, so it stays proportional if a token is overridden.
