// Pure editing logic for OTPInput, kept RN-free so it can be unit-tested in bare
// jsdom (the component itself pulls in react-native / moti / svg, which don't
// resolve under vitest's node env).

import type { OtpInputType } from './otp-input';

const REGEX_MAP: Record<OtpInputType, RegExp> = { alpha: /[^a-zA-Z]/g, numeric: /\D/g, alphanumeric: /[^a-zA-Z\d]/g };

export type OtpEdit = { value: string; caret: number };

export type ApplyEditOptions = { prev: string; raw: string; length: number; anchor: number; type?: OtpInputType };

/** Strip characters that don't match `type` and clamp to the slot count. */
export function sanitize(raw: string, length: number, type: OtpInputType = 'numeric'): string {
  const pattern = REGEX_MAP[type];
  return raw.replace(pattern, '').slice(0, length);
}

/**
 * Reconcile the raw string a controlled <input> produced against the previous
 * value, applying FIXED-GRID OVERWRITE semantics: a typed/pasted digit replaces
 * the digit already in the active slot (and the following slots, for multi-char
 * paste) instead of pushing them right. That keeps a mid-field retype in place
 * and stops the "insert then slice drops the tail" shifting the old code had.
 *
 * `anchor` is the slot the user is editing (the tapped/selected cell). For a
 * single typed digit we write at `anchor` rather than at the diff position `p`,
 * because RNW's controlled caret is racy across focus→render→layout-effect: a
 * tap on slot 2 can leave the hidden DOM caret at slot 3, so the browser inserts
 * the digit one slot too far right and the diff would blame the wrong cell. The
 * diff still tells us WHAT was typed; `anchor` decides WHERE it lands.
 *
 * Multi-char edits (paste) and deletions trust the diff position `p` — a paste
 * genuinely spans from the caret, and a deletion's removed region is exactly
 * what the browser cut (backspace before, delete after, range-delete the
 * selection), which the diff captures faithfully.
 *
 * Returns the next value plus where the caret should land.
 */
export function applyEdit({ prev, raw, length, anchor, type = 'numeric' }: ApplyEditOptions): OtpEdit {
  // Longest common prefix, then longest common suffix that doesn't overlap it.
  const max = Math.min(prev.length, raw.length);
  let p = 0;
  while (p < max && prev[p] === raw[p]) p += 1;
  let s = 0;
  while (s < prev.length - p && s < raw.length - p && prev.at(-1 - s) === raw.at(-1 - s)) s += 1;

  const removed = prev.length - p - s;
  const inserted = sanitize(raw.slice(p, raw.length - s), length, type);

  if (inserted.length === 0) {
    // Pure deletion (or a no-op edit) — accept the left-packed raw string and
    // drop the caret at the splice point.
    const value = sanitize(raw, length, type);
    return { value, caret: Math.min(p, value.length) };
  }

  // A single typed digit that removed nothing is a keystroke into the active
  // slot: write at `anchor` (caret-drift-proof). Anything else (paste, or an
  // edit that replaced a range) trusts the diff position.
  const at = removed === 0 && inserted.length === 1 ? Math.min(anchor, length) : p;

  // Overwrite `inserted` starting at `at`, preserving the slots it doesn't cover.
  const value = sanitize(prev.slice(0, at) + inserted + prev.slice(at + inserted.length), length, type);
  return { value, caret: Math.min(at + inserted.length, length) };
}
