/**
 * Tests for `buildMonthGrid`, the one function in the calendar core that returns a
 * shape rather than a value.
 *
 * Split from `calendar.test.ts` because it is the largest single seam there: the
 * padding, the row invariants and the `fixedWeeks` height are one subject, and the
 * date arithmetic underneath them is another.
 */
import { describe, expect, it } from 'vitest';
import { addDays, buildMonthGrid, type CalendarDay } from '../calendar';

/** Flattens a grid to its `date` strings, for order-sensitive assertions. */
const dates = (weeks: CalendarDay[][]) => weeks.flat().map((cell) => cell.date);

describe('buildMonthGrid', () => {
  it('pads the first week so the 1st sits under its own weekday', () => {
    // 1 August 2026 is a Saturday, so a Sunday-start grid needs six lead cells.
    const weeks = buildMonthGrid({ month: '2026-08-15' });
    expect(weeks[0]?.map((cell) => cell.date)).toEqual([
      '2026-07-26',
      '2026-07-27',
      '2026-07-28',
      '2026-07-29',
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
    ]);
  });

  it('emits rows of exactly seven cells, contiguous and ascending', () => {
    const weeks = buildMonthGrid({ month: '2026-08-15' });
    for (const week of weeks) expect(week).toHaveLength(7);

    const flat = dates(weeks);
    for (let index = 1; index < flat.length; index += 1) expect(flat[index]).toBe(addDays(String(flat[index - 1]), 1));
  });

  it('flags adjacent-month cells as outside and the rest as inside', () => {
    const weeks = buildMonthGrid({ month: '2026-08-15' });
    const inside = weeks.flat().filter((cell) => !cell.outside);
    expect(inside).toHaveLength(31);
    expect(inside[0]?.date).toBe('2026-08-01');
    expect(inside.at(-1)?.date).toBe('2026-08-31');
    expect(weeks.flat().every((cell) => cell.outside === (cell.month !== 8))).toBe(true);
  });

  it('honours weekStartsOn', () => {
    const sunday = buildMonthGrid({ month: '2026-08-15', weekStartsOn: 0 });
    const monday = buildMonthGrid({ month: '2026-08-15', weekStartsOn: 1 });
    expect(sunday[0]?.[0]?.weekday).toBe(0);
    expect(monday[0]?.[0]?.weekday).toBe(1);
    expect(monday[0]?.[0]?.date).toBe('2026-07-27');
  });

  it.each([0, 1, 2, 3, 4, 5, 6] as const)('starts every row on weekday %i when weekStartsOn is %i', (weekStartsOn) => {
    const weeks = buildMonthGrid({ month: '2026-08-15', weekStartsOn });
    for (const week of weeks) expect(week[0]?.weekday).toBe(weekStartsOn);
  });

  it('uses the natural row count by default', () => {
    // February 2026 starts on a Sunday and has 28 days: exactly four rows.
    expect(buildMonthGrid({ month: '2026-02-01' })).toHaveLength(4);
    expect(buildMonthGrid({ month: '2026-08-01' })).toHaveLength(6);
  });

  it('always emits six rows under fixedWeeks, keeping the height stable', () => {
    for (const month of ['2026-02-01', '2026-08-01', '2026-09-01', '2027-01-01'])
      expect(buildMonthGrid({ month, fixedWeeks: true })).toHaveLength(6);
  });

  it('extends with trailing outside days under fixedWeeks rather than repeating', () => {
    const weeks = buildMonthGrid({ month: '2026-02-01', fixedWeeks: true });
    const flat = dates(weeks);
    expect(flat).toHaveLength(42);
    expect(new Set(flat).size).toBe(42);
    expect(flat.at(-1)).toBe('2026-03-14');
  });

  it('accepts any day of the month as the anchor', () => {
    const fromFirst = dates(buildMonthGrid({ month: '2026-08-01' }));
    for (const anchor of ['2026-08-05', '2026-08-31']) expect(dates(buildMonthGrid({ month: anchor }))).toEqual(fromFirst);
  });

  it('carries the parts of each cell', () => {
    const cell = buildMonthGrid({ month: '2026-08-01' })
      .flat()
      .find((entry) => entry.date === '2026-08-05');
    expect(cell).toEqual({ date: '2026-08-05', day: 5, month: 8, year: 2026, weekday: 3, outside: false });
  });

  it('spans a year boundary in both directions', () => {
    const december = buildMonthGrid({ month: '2026-12-01' });
    expect(december.flat().at(-1)?.year).toBe(2027);
    const january = buildMonthGrid({ month: '2026-01-01' });
    expect(january.flat()[0]?.year).toBe(2025);
  });
});
