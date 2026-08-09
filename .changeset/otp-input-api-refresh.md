---
"rn-motion-ui": minor
---

**OtpInput: refreshed API with alpha/alphanumeric types, ref handle, and renamed props**

BREAKING prop renames (pre-release):

- `length` → `numberOfDigits`
- `mask` → `secureTextEntry`
- `onChange` → `onTextChange`
- `onComplete` → `onFilled`
- `status` / `OTPStatus` → `OtpInputStatus`

New features:

- **`type` prop** — `'numeric' | 'alpha' | 'alphanumeric'`. Controls which characters each slot accepts. The `sanitize` and `applyEdit` logic functions now accept a `type` parameter.
- **`ref` handle** (`OtpInputRef`) — exposes `focus()`, `blur()`, and `clear()` imperatively.
- **`autoComplete` prop** — forwarded to the hidden `TextInput`.
- **`stickBlinkMs` prop** — customise the cursor blink interval.

Internal: `applyEdit` now takes a single options object (`{ prev, raw, length, anchor, type }`) instead of positional arguments. Tests updated accordingly.
