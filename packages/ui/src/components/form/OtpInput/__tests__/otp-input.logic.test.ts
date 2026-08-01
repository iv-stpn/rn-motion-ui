import { describe, expect, it } from 'vitest';
import { applyEdit, sanitize } from '../otp-input.logic';

describe('sanitize', () => {
  it('strips non-digits and clamps to length', () => {
    expect(sanitize('1a2b3c', 6)).toBe('123');
    expect(sanitize('123456789', 6)).toBe('123456');
    expect(sanitize('', 6)).toBe('');
  });
});

describe('applyEdit', () => {
  it('appends a digit to an empty slot (left-to-right fill)', () => {
    expect(applyEdit('', '1', 6, 0)).toEqual({ value: '1', caret: 1 });
    expect(applyEdit('123', '1234', 6, 3)).toEqual({ value: '1234', caret: 4 });
  });

  it('overwrites the first slot in place instead of shifting', () => {
    // '123456' with the first char replaced -> '923456', tail untouched.
    expect(applyEdit('123456', '923456', 6, 0)).toEqual({ value: '923456', caret: 1 });
  });

  it('overwrites a middle slot in place (mid-field retype)', () => {
    // Tapped slot 2 (anchor 2), digit inserted there: raw gains a char at slot 2.
    expect(applyEdit('123456', '1293456', 6, 2)).toEqual({ value: '129456', caret: 3 });
  });

  it('writes a typed digit at the anchor even when the DOM caret drifted right', () => {
    // The bug this fixes: tap slot 2 (anchor 2) but RNW's controlled caret lands
    // at slot 3, so the browser inserts the digit one slot too far right
    // (raw = '1239456'). The diff position is 3, but the anchor pins it to slot 2.
    // Without the anchor override this would wrongly yield '123956' (the NEXT cell).
    expect(applyEdit('123456', '1239456', 6, 2)).toEqual({ value: '129456', caret: 3 });
  });

  it('overwrites the last slot in place', () => {
    // Caret before the last slot, type '9': raw is '12345' + '9' + '6'.
    expect(applyEdit('123456', '1234596', 6, 5)).toEqual({ value: '123459', caret: 6 });
  });

  it('overwrites when a slot range was selected and replaced (anchor ignored)', () => {
    // Slot 0-1 selected, replaced by a single digit. A range replace trusts the
    // diff position, so a stale anchor (5 here) must not move the write.
    expect(applyEdit('123456', '93456', 6, 5)).toEqual({ value: '923456', caret: 1 });
  });

  it('overwrites a multi-char paste in place (anchor ignored)', () => {
    // Caret before slot 1, paste '78' over the next two slots.
    expect(applyEdit('123456', '1783456', 6, 1)).toEqual({ value: '178456', caret: 3 });
  });

  it('caps an overwrite at the slot count', () => {
    // Paste past the end is truncated rather than growing the grid.
    expect(applyEdit('12', '12345678', 6, 2)).toEqual({ value: '123456', caret: 6 });
  });

  it('drops non-digits from a typed character (no-op)', () => {
    expect(applyEdit('123', '123x', 6, 3)).toEqual({ value: '123', caret: 3 });
  });

  it('left-packs a backspace (deletion shifts, no gap)', () => {
    // Backspace at the end.
    expect(applyEdit('123456', '12345', 6, 6)).toEqual({ value: '12345', caret: 5 });
    // Backspace in the middle collapses the gap.
    expect(applyEdit('123456', '12456', 6, 3)).toEqual({ value: '12456', caret: 2 });
  });

  it('clears everything on select-all + delete', () => {
    expect(applyEdit('123456', '', 6, 0)).toEqual({ value: '', caret: 0 });
  });
});
