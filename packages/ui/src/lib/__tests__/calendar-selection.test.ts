/**
 * Tests for the selection half of the headless calendar: what a press does, and
 * what each cell then claims about itself.
 *
 * These are the cases that are awkward to reach through a render — a range picked
 * backwards, an endpoint that is also the preview edge — so they are asserted
 * directly against the pure functions the hooks delegate to. Where the cursor
 * goes is the other half, in `calendar-focus.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import type { CalendarDay, DateRange } from '../calendar';
import { buildMonthGrid } from '../calendar';
import {
  type CalendarDayState,
  decorateDay,
  EMPTY_RANGE,
  isDayDisabled,
  nextRangeSelection,
  nextSingleSelection,
  previewRange,
} from '../calendar-selection';

const TODAY = '2026-08-05';

/** The bare cell shape `decorateDay` takes, pulled from a real grid. */
function cellFor(date: string): CalendarDay {
  const grid = buildMonthGrid({ month: date });
  const found = grid.flat().find((cell) => cell.date === date);
  if (!found) throw new Error(`no cell for ${date}`);
  return found;
}

/** Decorates one date with mostly-default options, overriding what a test cares about. */
function stateFor(date: string, overrides: Partial<Parameters<typeof decorateDay>[1]> = {}): CalendarDayState {
  return decorateDay(cellFor(date), {
    today: TODAY,
    selection: null,
    preview: null,
    focused: null,
    availability: {},
    ...overrides,
  });
}

describe('isDayDisabled', () => {
  it('is false with no constraints', () => {
    expect(isDayDisabled('2026-08-05', {})).toBe(false);
  });

  it('respects an inclusive minimum', () => {
    expect(isDayDisabled('2026-08-04', { minDate: '2026-08-05' })).toBe(true);
    expect(isDayDisabled('2026-08-05', { minDate: '2026-08-05' })).toBe(false);
  });

  it('respects an inclusive maximum', () => {
    expect(isDayDisabled('2026-08-06', { maxDate: '2026-08-05' })).toBe(true);
    expect(isDayDisabled('2026-08-05', { maxDate: '2026-08-05' })).toBe(false);
  });

  it('consults the caller predicate', () => {
    const noWeekends = (date: string) => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());
    expect(isDayDisabled('2026-08-08', { isDateDisabled: noWeekends })).toBe(true);
    expect(isDayDisabled('2026-08-07', { isDateDisabled: noWeekends })).toBe(false);
  });

  it('treats a predicate returning a non-true value as enabled', () => {
    expect(isDayDisabled('2026-08-05', { isDateDisabled: () => false })).toBe(false);
  });
});

describe('nextSingleSelection', () => {
  it('picks a day', () => {
    expect(nextSingleSelection(null, '2026-08-05', true)).toBe('2026-08-05');
  });

  it('replaces a different day', () => {
    expect(nextSingleSelection('2026-08-01', '2026-08-05', true)).toBe('2026-08-05');
  });

  it('clears when the selected day is re-picked and deselectable', () => {
    expect(nextSingleSelection('2026-08-05', '2026-08-05', true)).toBeNull();
  });

  it('keeps the day when re-picked and not deselectable', () => {
    expect(nextSingleSelection('2026-08-05', '2026-08-05', false)).toBe('2026-08-05');
  });
});

describe('nextRangeSelection', () => {
  it('sets the start on the first pick', () => {
    expect(nextRangeSelection(EMPTY_RANGE, '2026-08-05')).toEqual({ start: '2026-08-05', end: null });
  });

  it('completes the range on the second pick', () => {
    const afterFirst = nextRangeSelection(EMPTY_RANGE, '2026-08-05');
    expect(nextRangeSelection(afterFirst, '2026-08-09')).toEqual({ start: '2026-08-05', end: '2026-08-09' });
  });

  it('normalises a range picked backwards', () => {
    const afterFirst: DateRange = { start: '2026-08-09', end: null };
    expect(nextRangeSelection(afterFirst, '2026-08-05')).toEqual({ start: '2026-08-05', end: '2026-08-09' });
  });

  it('allows a single-day range', () => {
    const afterFirst: DateRange = { start: '2026-08-05', end: null };
    expect(nextRangeSelection(afterFirst, '2026-08-05')).toEqual({ start: '2026-08-05', end: '2026-08-05' });
  });

  it('restarts from a completed range rather than extending it', () => {
    const complete: DateRange = { start: '2026-08-05', end: '2026-08-09' };
    expect(nextRangeSelection(complete, '2026-08-20')).toEqual({ start: '2026-08-20', end: null });
  });

  it('does not mutate the range it is given', () => {
    const current: DateRange = { start: '2026-08-05', end: null };
    nextRangeSelection(current, '2026-08-09');
    expect(current).toEqual({ start: '2026-08-05', end: null });
  });

  it('leaves the frozen empty range intact', () => {
    nextRangeSelection(EMPTY_RANGE, '2026-08-05');
    expect(EMPTY_RANGE).toEqual({ start: null, end: null });
  });
});

describe('previewRange', () => {
  it('is null with no start', () => {
    expect(previewRange(EMPTY_RANGE, '2026-08-09')).toBeNull();
  });

  it('is null once the range is complete', () => {
    expect(previewRange({ start: '2026-08-05', end: '2026-08-09' }, '2026-08-20')).toBeNull();
  });

  it('is null with no candidate', () => {
    expect(previewRange({ start: '2026-08-05', end: null }, null)).toBeNull();
  });

  it('pairs the start with the candidate', () => {
    expect(previewRange({ start: '2026-08-05', end: null }, '2026-08-09')).toEqual({ start: '2026-08-05', end: '2026-08-09' });
  });

  it('normalises a candidate before the start', () => {
    expect(previewRange({ start: '2026-08-09', end: null }, '2026-08-05')).toEqual({ start: '2026-08-05', end: '2026-08-09' });
  });
});

describe('decorateDay', () => {
  it('marks today', () => {
    expect(stateFor(TODAY).isToday).toBe(true);
    expect(stateFor('2026-08-06').isToday).toBe(false);
  });

  it('marks the focus cursor', () => {
    expect(stateFor('2026-08-09', { focused: '2026-08-09' }).isFocused).toBe(true);
    expect(stateFor('2026-08-09', { focused: '2026-08-08' }).isFocused).toBe(false);
  });

  it('marks weekends, and honours an override', () => {
    expect(stateFor('2026-08-08').isWeekend).toBe(true);
    expect(stateFor('2026-08-07').isWeekend).toBe(false);
    // A Friday/Saturday weekend, as used across much of the Middle East.
    expect(stateFor('2026-08-07', { weekendDays: [5, 6] }).isWeekend).toBe(true);
  });

  it('carries the grid cell fields through untouched', () => {
    const state = stateFor('2026-08-05');
    expect(state).toMatchObject({ date: '2026-08-05', day: 5, month: 8, year: 2026, outside: false });
  });

  describe('single mode', () => {
    it('marks the selected day', () => {
      expect(stateFor('2026-08-05', { selection: '2026-08-05' }).isSelected).toBe(true);
      expect(stateFor('2026-08-06', { selection: '2026-08-05' }).isSelected).toBe(false);
    });

    it('never reports range flags', () => {
      const state = stateFor('2026-08-05', { selection: '2026-08-05' });
      expect(state.isInRange).toBe(false);
      expect(state.isRangeStart).toBe(false);
      expect(state.isRangeEnd).toBe(false);
    });
  });

  describe('range mode', () => {
    const selection: DateRange = { start: '2026-08-05', end: '2026-08-09' };

    it('marks both endpoints as selected', () => {
      expect(stateFor('2026-08-05', { selection }).isSelected).toBe(true);
      expect(stateFor('2026-08-09', { selection }).isSelected).toBe(true);
    });

    it('distinguishes the two endpoints', () => {
      expect(stateFor('2026-08-05', { selection })).toMatchObject({ isRangeStart: true, isRangeEnd: false });
      expect(stateFor('2026-08-09', { selection })).toMatchObject({ isRangeStart: false, isRangeEnd: true });
    });

    it('marks the interior, endpoints excluded', () => {
      expect(stateFor('2026-08-07', { selection }).isInRange).toBe(true);
      expect(stateFor('2026-08-05', { selection }).isInRange).toBe(false);
      expect(stateFor('2026-08-09', { selection }).isInRange).toBe(false);
    });

    it('excludes days outside the range', () => {
      expect(stateFor('2026-08-04', { selection }).isInRange).toBe(false);
      expect(stateFor('2026-08-10', { selection }).isInRange).toBe(false);
    });

    it('normalises a stored range that is backwards', () => {
      const backwards: DateRange = { start: '2026-08-09', end: '2026-08-05' };
      expect(stateFor('2026-08-07', { selection: backwards }).isInRange).toBe(true);
      expect(stateFor('2026-08-05', { selection: backwards }).isRangeStart).toBe(true);
    });

    it('gives a half-open range no interior', () => {
      const half: DateRange = { start: '2026-08-05', end: null };
      expect(stateFor('2026-08-07', { selection: half }).isInRange).toBe(false);
      expect(stateFor('2026-08-05', { selection: half }).isSelected).toBe(true);
    });

    it('reports a one-day range as both endpoints and no interior', () => {
      const single: DateRange = { start: '2026-08-05', end: '2026-08-05' };
      expect(stateFor('2026-08-05', { selection: single })).toMatchObject({
        isRangeStart: true,
        isRangeEnd: true,
        isInRange: false,
        isSelected: true,
      });
    });

    it('marks the preview band, endpoints included', () => {
      const preview: DateRange = { start: '2026-08-05', end: '2026-08-09' };
      expect(stateFor('2026-08-07', { preview }).isPreview).toBe(true);
      expect(stateFor('2026-08-05', { preview }).isPreview).toBe(true);
      expect(stateFor('2026-08-10', { preview }).isPreview).toBe(false);
    });
  });

  it('reports a bounds-excluded day as disabled', () => {
    expect(stateFor('2026-08-04', { availability: { minDate: TODAY } }).isDisabled).toBe(true);
  });
});
