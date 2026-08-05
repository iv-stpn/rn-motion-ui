/**
 * Tests for where the keyboard moves the focus cursor, and which keys the grid
 * claims at all.
 *
 * Split from `calendar-selection.test.ts`: what a press does to the selection and
 * what an arrow key does to the cursor are two subjects, and the second one carries
 * the whole step table, the bounds clamping and the RTL mirroring with it.
 *
 * The key set matters as much as the movement. A grid that swallows a key it does
 * not act on takes Tab away from the user, so the negative cases here are load
 * bearing rather than exhaustive for its own sake.
 */

import { describe, expect, it } from 'vitest';
import { isCalendarNavigationKey, nextFocusedDate } from '../calendar-selection';

const TODAY = '2026-08-05';

describe('nextFocusedDate', () => {
  it('returns null for a key it does not handle', () => {
    expect(nextFocusedDate({ from: TODAY, key: 'a' })).toBeNull();
    expect(nextFocusedDate({ from: TODAY, key: 'Enter' })).toBeNull();
  });

  it('steps by a day horizontally', () => {
    expect(nextFocusedDate({ from: TODAY, key: 'ArrowLeft' })).toBe('2026-08-04');
    expect(nextFocusedDate({ from: TODAY, key: 'ArrowRight' })).toBe('2026-08-06');
  });

  it('steps by a week vertically', () => {
    expect(nextFocusedDate({ from: TODAY, key: 'ArrowUp' })).toBe('2026-07-29');
    expect(nextFocusedDate({ from: TODAY, key: 'ArrowDown' })).toBe('2026-08-12');
  });

  it('mirrors only the horizontal axis under RTL', () => {
    expect(nextFocusedDate({ from: TODAY, key: 'ArrowRight', isRTL: true })).toBe('2026-08-04');
    expect(nextFocusedDate({ from: TODAY, key: 'ArrowLeft', isRTL: true })).toBe('2026-08-06');
    // Down is still "next week" in an RTL grid.
    expect(nextFocusedDate({ from: TODAY, key: 'ArrowDown', isRTL: true })).toBe('2026-08-12');
  });

  it('pages by a month, clamping the day', () => {
    expect(nextFocusedDate({ from: TODAY, key: 'PageUp' })).toBe('2026-07-05');
    expect(nextFocusedDate({ from: TODAY, key: 'PageDown' })).toBe('2026-09-05');
    // Jan 31 → Feb has no 31st; the day clamps rather than rolling into March.
    expect(nextFocusedDate({ from: '2026-01-31', key: 'PageDown' })).toBe('2026-02-28');
  });

  it('pages by a year with shift', () => {
    expect(nextFocusedDate({ from: TODAY, key: 'PageUp', shiftKey: true })).toBe('2025-08-05');
    expect(nextFocusedDate({ from: TODAY, key: 'PageDown', shiftKey: true })).toBe('2027-08-05');
  });

  it('snaps Home/End to the row edges', () => {
    // 2026-08-05 is a Wednesday; a Sunday-start week runs Aug 2 – Aug 8.
    expect(nextFocusedDate({ from: TODAY, key: 'Home' })).toBe('2026-08-02');
    expect(nextFocusedDate({ from: TODAY, key: 'End' })).toBe('2026-08-08');
  });

  it('snaps Home/End against the configured week start', () => {
    // Monday-start: Aug 3 – Aug 9.
    expect(nextFocusedDate({ from: TODAY, key: 'Home', weekStartsOn: 1 })).toBe('2026-08-03');
    expect(nextFocusedDate({ from: TODAY, key: 'End', weekStartsOn: 1 })).toBe('2026-08-09');
  });

  it('crosses a month boundary', () => {
    expect(nextFocusedDate({ from: '2026-08-01', key: 'ArrowLeft' })).toBe('2026-07-31');
    expect(nextFocusedDate({ from: '2026-08-31', key: 'ArrowRight' })).toBe('2026-09-01');
  });

  it('crosses a year boundary', () => {
    expect(nextFocusedDate({ from: '2026-01-01', key: 'ArrowLeft' })).toBe('2025-12-31');
  });

  it('clamps to the allowed window instead of refusing to move', () => {
    expect(nextFocusedDate({ from: TODAY, key: 'ArrowLeft', minDate: TODAY })).toBe(TODAY);
    expect(nextFocusedDate({ from: TODAY, key: 'PageUp', minDate: '2026-08-01' })).toBe('2026-08-01');
    expect(nextFocusedDate({ from: TODAY, key: 'PageDown', maxDate: '2026-08-31' })).toBe('2026-08-31');
  });

  it('still lands on a disabled day inside the window', () => {
    // Disabled days take focus so a blocked stretch stays crossable; only the
    // bounds clamp. The cell's own disabled state conveys that it can't be picked.
    const landed = nextFocusedDate({ from: TODAY, key: 'ArrowRight', minDate: '2026-08-01', maxDate: '2026-08-31' });
    expect(landed).toBe('2026-08-06');
  });
});

describe('isCalendarNavigationKey', () => {
  it('accepts the keys the grid handles', () => {
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'])
      expect(isCalendarNavigationKey(key)).toBe(true);
  });

  it('rejects everything else', () => {
    for (const key of ['Enter', ' ', 'Escape', 'Tab', 'a']) expect(isCalendarNavigationKey(key)).toBe(false);
  });

  it('is not fooled by inherited object keys', () => {
    // A plain `key in DAY_STEP` would answer true for these.
    for (const key of ['toString', 'constructor', 'hasOwnProperty']) expect(isCalendarNavigationKey(key)).toBe(false);
  });
});
