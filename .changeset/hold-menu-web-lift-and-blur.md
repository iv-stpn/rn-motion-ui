---
'rn-motion-ui': patch
---

fix(ui): HoldMenu — blurred lighter backdrop (Android too), web lift and glide, eased motion

- Backdrop: the dark dim on blur-capable platforms drops from rgba(0,0,0,0.75)
  to rgba(0,0,0,0.5), and Android joins the blur tier (expo-blur supports it;
  the guarded fallback keeps the plain dim when the optional peer is absent)
  instead of the near-opaque black scrim. The web frost is stronger
  (backdrop-filter blur(30px)).
- Web lift: right-clicking (or clicking, for tap activation) a hold item now
  runs the library's lift choreography in place — a quick 120ms squeeze, then
  the item scales back up (eased) and glides with the panel as the menu pops
  out of it. The portal twin stays native-only; children still render exactly
  once on web.
- No travel when it fits: the item glides only when the menu would overflow —
  the same tY the panel travels, which is zero when everything fits, so the
  item stays put in the common case.
- Motion: scale-ups and the backdrop/panel fades now use Easing.out(Easing.cubic).
  Web activation re-measures the item on every open instead of caching the
  first rect.
