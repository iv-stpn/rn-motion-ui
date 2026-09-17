import { describe, expect, it } from 'vitest';
import { isRovingArrow, nextRovingIndex } from '../roving';

describe('isRovingArrow', () => {
  it('accepts the four arrow keys', () => {
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) expect(isRovingArrow(key)).toBe(true);
  });

  it('rejects non-arrow keys', () => {
    for (const key of ['Enter', ' ', 'Home', 'End', 'Tab', 'Escape', 'a']) expect(isRovingArrow(key)).toBe(false);
  });
});

describe('nextRovingIndex', () => {
  it('returns -1 for an empty list', () => {
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] as const) expect(nextRovingIndex(0, 0, key)).toBe(-1);
  });

  it('holds the lone item for every key', () => {
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] as const) expect(nextRovingIndex(0, 1, key)).toBe(0);
  });

  it('forward keys step forward and wrap from the last item', () => {
    expect(nextRovingIndex(0, 4, 'ArrowRight')).toBe(1);
    expect(nextRovingIndex(3, 4, 'ArrowRight')).toBe(0);
    expect(nextRovingIndex(0, 4, 'ArrowDown')).toBe(1);
    expect(nextRovingIndex(3, 4, 'ArrowDown')).toBe(0);
  });

  it('backward keys step back and wrap from the first item', () => {
    expect(nextRovingIndex(2, 4, 'ArrowLeft')).toBe(1);
    expect(nextRovingIndex(0, 4, 'ArrowLeft')).toBe(3);
    expect(nextRovingIndex(2, 4, 'ArrowUp')).toBe(1);
    expect(nextRovingIndex(0, 4, 'ArrowUp')).toBe(3);
  });

  it('enters from nowhere: forward to the first item, backward to the last', () => {
    expect(nextRovingIndex(-1, 4, 'ArrowRight')).toBe(0);
    expect(nextRovingIndex(-1, 4, 'ArrowDown')).toBe(0);
    expect(nextRovingIndex(-1, 4, 'ArrowLeft')).toBe(3);
    expect(nextRovingIndex(-1, 4, 'ArrowUp')).toBe(3);
  });

  it('treats an out-of-range current like the not-yet-selected sentinel', () => {
    expect(nextRovingIndex(4, 4, 'ArrowRight')).toBe(0);
    expect(nextRovingIndex(4, 4, 'ArrowLeft')).toBe(3);
  });
});
