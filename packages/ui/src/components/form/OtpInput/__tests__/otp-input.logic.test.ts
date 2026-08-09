import { describe, expect, it } from 'vitest';
import { applyEdit, sanitize } from '../otp-input.logic';

describe('sanitize', () => {
  describe('numeric', () => {
    it('strips non-digits and clamps to length', () => {
      expect(sanitize('1a2b3c', 6)).toBe('123');
      expect(sanitize('123456789', 6)).toBe('123456');
      expect(sanitize('', 6)).toBe('');
    });
  });

  describe('alpha', () => {
    it('strips non-letters and clamps to length', () => {
      expect(sanitize('a1b2c3', 6, 'alpha')).toBe('abc');
      expect(sanitize('abcdefg', 4, 'alpha')).toBe('abcd');
      expect(sanitize('', 6, 'alpha')).toBe('');
    });
  });

  describe('alphanumeric', () => {
    it('strips non-alphanumeric and clamps to length', () => {
      expect(sanitize('a1!b2@c3', 8, 'alphanumeric')).toBe('a1b2c3');
      expect(sanitize('ab12cd34ef', 6, 'alphanumeric')).toBe('ab12cd');
      expect(sanitize('', 6, 'alphanumeric')).toBe('');
    });
  });
});

describe('applyEdit', () => {
  const opts = (overrides: Partial<Parameters<typeof applyEdit>[0]> = {}) => ({
    prev: '',
    raw: '',
    length: 6,
    anchor: 0,
    type: 'numeric' as const,
    ...overrides,
  });

  it('appends a digit to an empty slot (left-to-right fill)', () => {
    expect(applyEdit(opts({ prev: '', raw: '1', anchor: 0 }))).toEqual({ value: '1', caret: 1 });
    expect(applyEdit(opts({ prev: '123', raw: '1234', anchor: 3 }))).toEqual({ value: '1234', caret: 4 });
  });

  it('overwrites the first slot in place instead of shifting', () => {
    expect(applyEdit(opts({ prev: '123456', raw: '923456', anchor: 0 }))).toEqual({ value: '923456', caret: 1 });
  });

  it('overwrites a middle slot in place (mid-field retype)', () => {
    expect(applyEdit(opts({ prev: '123456', raw: '1293456', anchor: 2 }))).toEqual({ value: '129456', caret: 3 });
  });

  it('writes a typed digit at the anchor even when the DOM caret drifted right', () => {
    // The bug this fixes: tap slot 2 (anchor 2) but RNW's controlled caret lands
    // at slot 3, so the browser inserts the digit one slot too far right
    // (raw = '1239456'). The diff position is 3, but the anchor pins it to slot 2.
    expect(applyEdit(opts({ prev: '123456', raw: '1239456', anchor: 2 }))).toEqual({ value: '129456', caret: 3 });
  });

  it('overwrites the last slot in place', () => {
    expect(applyEdit(opts({ prev: '123456', raw: '1234596', anchor: 5 }))).toEqual({ value: '123459', caret: 6 });
  });

  it('overwrites when a slot range was selected and replaced (anchor ignored)', () => {
    expect(applyEdit(opts({ prev: '123456', raw: '93456', anchor: 5 }))).toEqual({ value: '923456', caret: 1 });
  });

  it('overwrites a multi-char paste in place (anchor ignored)', () => {
    expect(applyEdit(opts({ prev: '123456', raw: '1783456', anchor: 1 }))).toEqual({ value: '178456', caret: 3 });
  });

  it('caps an overwrite at the slot count', () => {
    expect(applyEdit(opts({ prev: '12', raw: '12345678', anchor: 2 }))).toEqual({ value: '123456', caret: 6 });
  });

  it('drops non-digits from a typed character (no-op)', () => {
    expect(applyEdit(opts({ prev: '123', raw: '123x', anchor: 3 }))).toEqual({ value: '123', caret: 3 });
  });

  it('left-packs a backspace (deletion shifts, no gap)', () => {
    // Backspace at the end.
    expect(applyEdit(opts({ prev: '123456', raw: '12345', anchor: 6 }))).toEqual({ value: '12345', caret: 5 });
    // Backspace in the middle collapses the gap.
    expect(applyEdit(opts({ prev: '123456', raw: '12456', anchor: 3 }))).toEqual({ value: '12456', caret: 2 });
  });

  it('clears everything on select-all + delete', () => {
    expect(applyEdit(opts({ prev: '123456', raw: '', anchor: 0 }))).toEqual({ value: '', caret: 0 });
  });

  describe('alpha type', () => {
    it('strips digits and keeps only letters', () => {
      expect(applyEdit(opts({ prev: '', raw: 'a', anchor: 0, type: 'alpha' }))).toEqual({ value: 'a', caret: 1 });
      expect(applyEdit(opts({ prev: 'ab', raw: 'ab1', anchor: 2, type: 'alpha' }))).toEqual({ value: 'ab', caret: 2 });
    });
  });

  describe('alphanumeric type', () => {
    it('keeps letters and digits but strips symbols', () => {
      expect(applyEdit(opts({ prev: '', raw: 'a1', anchor: 0, type: 'alphanumeric' }))).toEqual({ value: 'a1', caret: 2 });
      expect(applyEdit(opts({ prev: 'a1', raw: 'a1!', anchor: 2, type: 'alphanumeric' }))).toEqual({ value: 'a1', caret: 2 });
    });
  });
});
