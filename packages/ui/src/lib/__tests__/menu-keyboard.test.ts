import { describe, expect, it } from 'vitest';
import { isMenuNavKey, nextMenuIndex } from '../menu-keyboard';

describe('isMenuNavKey', () => {
  it('accepts only the four roving-focus keys', () => {
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) expect(isMenuNavKey(key)).toBe(true);
  });

  it('rejects the keys the Pressable row already owns', () => {
    // Enter/Space activate via Pressable's own key handler, and anything else is
    // not the menu's to move on — none of these may trigger a focus move.
    for (const key of ['Enter', ' ', 'Spacebar', 'Tab', 'Escape', 'a', 'ArrowLeft', 'ArrowRight'])
      expect(isMenuNavKey(key)).toBe(false);
  });
});

describe('nextMenuIndex', () => {
  it('returns -1 for an empty menu', () => {
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End'] as const) expect(nextMenuIndex(0, 0, key)).toBe(-1);
  });

  it('holds the lone row for every key', () => {
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End'] as const) expect(nextMenuIndex(0, 1, key)).toBe(0);
  });

  it('Home and End jump to the ends regardless of current', () => {
    expect(nextMenuIndex(2, 5, 'Home')).toBe(0);
    expect(nextMenuIndex(0, 5, 'End')).toBe(4);
  });

  it('ArrowDown steps forward and wraps from the last row', () => {
    expect(nextMenuIndex(0, 4, 'ArrowDown')).toBe(1);
    expect(nextMenuIndex(3, 4, 'ArrowDown')).toBe(0);
  });

  it('ArrowUp steps back and wraps from the first row', () => {
    expect(nextMenuIndex(2, 4, 'ArrowUp')).toBe(1);
    expect(nextMenuIndex(0, 4, 'ArrowUp')).toBe(3);
  });

  it('enters from nowhere: ArrowDown to the first row, ArrowUp to the last', () => {
    // `-1` is the "focus has not landed inside the menu yet" sentinel — from the
    // container or the trigger — so ArrowDown starts at the top and ArrowUp at
    // the bottom, per the WAI-ARIA menu pattern.
    expect(nextMenuIndex(-1, 4, 'ArrowDown')).toBe(0);
    expect(nextMenuIndex(-1, 4, 'ArrowUp')).toBe(3);
  });

  it('treats an out-of-range current like the not-yet-focused sentinel', () => {
    expect(nextMenuIndex(4, 4, 'ArrowDown')).toBe(0);
    expect(nextMenuIndex(4, 4, 'ArrowUp')).toBe(3);
  });
});
