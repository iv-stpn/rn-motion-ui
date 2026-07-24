---
"rn-motion-ui": minor
---

OTPInput: tap any slot to move the edit caret there (not just the first empty cell). Editing logic extracted to `otp-input.logic.ts` (pure, RN-free, unit-tested) and switched to fixed-grid overwrite semantics via `applyEdit` — a typed digit replaces the active slot in-place instead of shifting the tail. Fixes a RNW caret-drift bug where a tap on slot N could land the keystroke in slot N+1. `onComplete` now fires on every edit that yields a full-length code (not only the first incomplete→complete transition), so retyping a slot of an already-complete code re-validates.
