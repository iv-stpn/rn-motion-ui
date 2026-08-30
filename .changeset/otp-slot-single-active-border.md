---
'rn-motion-ui': patch
---

fix(OtpInput): remove the doubled border on the selected slot

The active slot painted its border twice: the slot's own `active` cva variant and
an absolutely-positioned outline ring both drew a `border-foreground` edge, so the
selected cell read as a thick doubled border. The ring is removed — the slot's own
border (still recolored by `focusColor` / `focusedPinCodeContainerStyle`) is now the
single source of truth for the selected state.
