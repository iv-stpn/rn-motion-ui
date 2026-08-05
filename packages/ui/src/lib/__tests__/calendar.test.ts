/**
 * Tests for the pure calendar core.
 *
 * Two classes of bug are what these guard, because both are invisible until a
 * user in the wrong timezone or the wrong month reports them:
 *
 *  1. **Local-time arithmetic.** A day is 23 or 25 hours long on a DST boundary,
 *     so `+1 day` implemented in local time can land back on the same date. The
 *     stepping tests walk whole years one day at a time, which fails loudly if
 *     the arithmetic ever moves off UTC.
 *  2. **UTC "today".** `new Date().toISOString()` names tomorrow for anyone east
 *     of UTC late in the evening. `todayISO` is asserted against local getters.
 *
 * The grid builder and the range helpers are the core's two other subjects, and
 * live in `calendar-grid.test.ts` and `calendar-range.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  clampISO,
  compareISO,
  daysInMonth,
  endOfMonth,
  isISODate,
  isLeapYear,
  isoDate,
  isSameDay,
  isSameMonth,
  isWithinBounds,
  parseISODate,
  startOfMonth,
  todayISO,
  toUTCDate,
  weekdayOf,
} from '../calendar';

describe('isoDate', () => {
  it('pads month and day to two digits', () => {
    expect(isoDate(2026, 1, 5)).toBe('2026-01-05');
  });

  it('normalises an out-of-range day into the next month', () => {
    expect(isoDate(2026, 1, 32)).toBe('2026-02-01');
  });

  it('normalises month 13 into the next year', () => {
    expect(isoDate(2026, 13, 1)).toBe('2027-01-01');
  });

  it('normalises day 0 to the last day of the previous month', () => {
    expect(isoDate(2026, 3, 0)).toBe('2026-02-28');
  });

  it('pads a year below 1000 to four digits', () => {
    expect(isoDate(999, 1, 1)).toBe('0999-01-01');
  });
});

describe('parseISODate', () => {
  it('parses a well-formed date', () => {
    expect(parseISODate('2026-08-05')).toEqual({ year: 2026, month: 8, day: 5 });
  });

  it.each(['2026-8-5', '26-08-05', '2026/08/05', '', 'not-a-date', '2026-08-05T00:00:00Z'])(
    'rejects the malformed shape %j',
    (value) => {
      expect(parseISODate(value)).toBeNull();
    },
  );

  it('rejects a day that does not exist, rather than rolling it forward', () => {
    // The contrast with isoDate is the point: validation must not normalise.
    expect(parseISODate('2026-02-30')).toBeNull();
    expect(isoDate(2026, 2, 30)).toBe('2026-03-02');
  });

  it.each(['2026-00-10', '2026-13-10', '2026-08-00', '2026-04-31'])('rejects the impossible date %s', (value) => {
    expect(parseISODate(value)).toBeNull();
  });

  it('accepts 29 February only in a leap year', () => {
    expect(parseISODate('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 });
    expect(parseISODate('2026-02-29')).toBeNull();
  });
});

describe('isISODate', () => {
  it('accepts a real date string', () => {
    expect(isISODate('2026-08-05')).toBe(true);
  });

  it.each([undefined, null, 42, {}, ['2026-08-05'], new Date(), '2026-02-30'])('rejects %j', (value) => {
    expect(isISODate(value)).toBe(false);
  });
});

describe('todayISO', () => {
  it('reads the local calendar date, not the UTC one', () => {
    // 23:30 local on the 5th. Anywhere east of UTC this instant is already the
    // 6th in UTC, so a toISOString()-based implementation returns 2026-08-06.
    const localLateEvening = new Date(2026, 7, 5, 23, 30, 0);
    expect(todayISO(localLateEvening)).toBe('2026-08-05');
  });

  it('reads the local calendar date just after midnight', () => {
    // The mirror case: west of UTC this instant is still the 5th in UTC.
    expect(todayISO(new Date(2026, 7, 6, 0, 30, 0))).toBe('2026-08-06');
  });

  it('agrees with the local getters for an arbitrary instant', () => {
    const now = new Date(2027, 0, 31, 12, 0, 0);
    expect(todayISO(now)).toBe(isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate()));
  });
});

describe('compareISO', () => {
  it('orders chronologically', () => {
    expect(compareISO('2026-08-05', '2026-08-06')).toBe(-1);
    expect(compareISO('2026-08-06', '2026-08-05')).toBe(1);
    expect(compareISO('2026-08-05', '2026-08-05')).toBe(0);
  });

  it('sorts a shuffled list into chronological order', () => {
    const shuffled = ['2026-12-01', '2025-01-31', '2026-01-02', '2026-01-10'];
    expect([...shuffled].sort(compareISO)).toEqual(['2025-01-31', '2026-01-02', '2026-01-10', '2026-12-01']);
  });
});

describe('isSameDay / isSameMonth', () => {
  it('matches identical days', () => {
    expect(isSameDay('2026-08-05', '2026-08-05')).toBe(true);
    expect(isSameDay('2026-08-05', '2026-08-06')).toBe(false);
  });

  it('is false when either side is absent, so an empty selection matches nothing', () => {
    expect(isSameDay(null, null)).toBe(false);
    expect(isSameDay(undefined, '2026-08-05')).toBe(false);
    expect(isSameDay('2026-08-05', null)).toBe(false);
  });

  it('compares month and year together', () => {
    expect(isSameMonth('2026-08-01', '2026-08-31')).toBe(true);
    expect(isSameMonth('2026-08-01', '2025-08-01')).toBe(false);
  });
});

describe('daysInMonth / isLeapYear', () => {
  it.each([
    [1, 31],
    [2, 28],
    [4, 30],
    [12, 31],
  ])('month %i of 2026 has %i days', (month, expected) => {
    expect(daysInMonth(2026, month)).toBe(expected);
  });

  it('applies the full Gregorian leap rule', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    // Divisible by 100 but not 400 — not a leap year, the rule most often missed.
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(daysInMonth(2024, 2)).toBe(29);
  });
});

describe('weekdayOf', () => {
  it('reports Sunday as 0 through Saturday as 6', () => {
    expect(weekdayOf('2026-08-02')).toBe(0);
    expect(weekdayOf('2026-08-05')).toBe(3);
    expect(weekdayOf('2026-08-08')).toBe(6);
  });
});

describe('addDays', () => {
  it('steps forward and back', () => {
    expect(addDays('2026-08-05', 1)).toBe('2026-08-06');
    expect(addDays('2026-08-05', -1)).toBe('2026-08-04');
    expect(addDays('2026-08-05', 0)).toBe('2026-08-05');
  });

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('crosses 29 February in a leap year', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('steps through a whole non-leap year in exactly 365 moves', () => {
    // The DST guard: local-time arithmetic drifts on the transition days, so a
    // year of single-day steps would not land on 31 December.
    let cursor = '2026-01-01';
    for (let index = 0; index < 364; index += 1) cursor = addDays(cursor, 1);
    expect(cursor).toBe('2026-12-31');
  });

  it('steps through a whole leap year in exactly 366 moves', () => {
    let cursor = '2024-01-01';
    for (let index = 0; index < 365; index += 1) cursor = addDays(cursor, 1);
    expect(cursor).toBe('2024-12-31');
  });

  it('is exactly reversible across a northern-hemisphere DST transition', () => {
    for (const date of ['2026-03-29', '2026-10-25', '2026-03-08', '2026-11-01']) expect(addDays(addDays(date, 1), -1)).toBe(date);
  });
});

describe('addMonths', () => {
  it('shifts forward and back', () => {
    expect(addMonths('2026-08-05', 1)).toBe('2026-09-05');
    expect(addMonths('2026-08-05', -1)).toBe('2026-07-05');
  });

  it('crosses the year boundary', () => {
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
    expect(addMonths('2026-08-05', 12)).toBe('2027-08-05');
  });

  it('clamps the day instead of overflowing into the month after next', () => {
    // The bug this prevents: 31 Jan + 1 month as naive arithmetic gives 31 Feb,
    // which normalises to 3 March — so a "next month" button skips February.
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonths('2026-05-31', 1)).toBe('2026-06-30');
  });

  it('reaches every month when stepping from the 31st', () => {
    const months: string[] = [];
    let cursor = '2026-01-31';
    for (let index = 0; index < 12; index += 1) {
      months.push(cursor.slice(0, 7));
      cursor = addMonths(cursor, 1);
    }
    expect(months).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
    ]);
  });
});

describe('startOfMonth / endOfMonth', () => {
  it('finds the first and last day', () => {
    expect(startOfMonth('2026-08-05')).toBe('2026-08-01');
    expect(endOfMonth('2026-08-05')).toBe('2026-08-31');
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(endOfMonth('2024-02-10')).toBe('2024-02-29');
  });
});

describe('clampISO / isWithinBounds', () => {
  it('pulls a date to the nearest bound', () => {
    expect(clampISO('2026-08-05', '2026-08-10', '2026-08-20')).toBe('2026-08-10');
    expect(clampISO('2026-08-25', '2026-08-10', '2026-08-20')).toBe('2026-08-20');
    expect(clampISO('2026-08-15', '2026-08-10', '2026-08-20')).toBe('2026-08-15');
  });

  it('treats an absent bound as unbounded', () => {
    expect(clampISO('2026-08-05')).toBe('2026-08-05');
    expect(clampISO('2026-08-05', null, null)).toBe('2026-08-05');
    expect(clampISO('1900-01-01', undefined, '2026-08-20')).toBe('1900-01-01');
  });

  it('includes both bounds', () => {
    expect(isWithinBounds('2026-08-10', '2026-08-10', '2026-08-20')).toBe(true);
    expect(isWithinBounds('2026-08-20', '2026-08-10', '2026-08-20')).toBe(true);
    expect(isWithinBounds('2026-08-09', '2026-08-10', '2026-08-20')).toBe(false);
    expect(isWithinBounds('2026-08-21', '2026-08-10', '2026-08-20')).toBe(false);
    expect(isWithinBounds('2026-08-05')).toBe(true);
  });
});

describe('toUTCDate', () => {
  it('returns UTC midnight of the calendar day', () => {
    const date = toUTCDate('2026-08-05');
    expect(date.toISOString()).toBe('2026-08-05T00:00:00.000Z');
  });
});
