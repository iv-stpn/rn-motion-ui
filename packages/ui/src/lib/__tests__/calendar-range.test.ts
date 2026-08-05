/**
 * Tests for the range helpers in the calendar core: normalising, completeness,
 * membership, length and enumeration.
 *
 * Split from `calendar.test.ts` so the range algebra reads as one subject. Every
 * one of these normalises first, which is the property the suite is really about:
 * a range picked backwards is the same span as the same range picked forwards.
 */
import { describe, expect, it } from 'vitest';
import { type DateRange, eachDayInRange, isRangeComplete, isWithinRange, normalizeRange, rangeLength } from '../calendar';

describe('normalizeRange', () => {
  it('swaps a backwards range', () => {
    expect(normalizeRange({ start: '2026-08-20', end: '2026-08-10' })).toEqual({
      start: '2026-08-10',
      end: '2026-08-20',
    });
  });

  it('leaves an ordered range untouched', () => {
    const ordered: DateRange = { start: '2026-08-10', end: '2026-08-20' };
    expect(normalizeRange(ordered)).toEqual(ordered);
  });

  it('leaves an incomplete range untouched', () => {
    expect(normalizeRange({ start: '2026-08-10', end: null })).toEqual({ start: '2026-08-10', end: null });
    expect(normalizeRange({ start: null, end: '2026-08-10' })).toEqual({ start: null, end: '2026-08-10' });
    expect(normalizeRange({ start: null, end: null })).toEqual({ start: null, end: null });
  });
});

describe('isRangeComplete', () => {
  it('requires both sides', () => {
    expect(isRangeComplete({ start: '2026-08-10', end: '2026-08-20' })).toBe(true);
    expect(isRangeComplete({ start: '2026-08-10', end: null })).toBe(false);
    expect(isRangeComplete({ start: null, end: null })).toBe(false);
  });
});

describe('isWithinRange', () => {
  const range: DateRange = { start: '2026-08-10', end: '2026-08-20' };

  it('includes both ends', () => {
    expect(isWithinRange('2026-08-10', range)).toBe(true);
    expect(isWithinRange('2026-08-20', range)).toBe(true);
    expect(isWithinRange('2026-08-15', range)).toBe(true);
  });

  it('excludes days outside', () => {
    expect(isWithinRange('2026-08-09', range)).toBe(false);
    expect(isWithinRange('2026-08-21', range)).toBe(false);
  });

  it('matches a backwards range the same way', () => {
    const backwards: DateRange = { start: '2026-08-20', end: '2026-08-10' };
    expect(isWithinRange('2026-08-15', backwards)).toBe(true);
  });

  it('matches only the picked day while the range is half-open', () => {
    // Otherwise the first click of a two-click selection highlights every day
    // after it, which reads as though the range were already chosen.
    expect(isWithinRange('2026-08-10', { start: '2026-08-10', end: null })).toBe(true);
    expect(isWithinRange('2026-08-11', { start: '2026-08-10', end: null })).toBe(false);
    expect(isWithinRange('2026-08-10', { start: null, end: '2026-08-10' })).toBe(true);
  });

  it('matches nothing when the range is empty', () => {
    expect(isWithinRange('2026-08-10', { start: null, end: null })).toBe(false);
  });
});

describe('rangeLength', () => {
  it('counts inclusively', () => {
    expect(rangeLength({ start: '2026-08-10', end: '2026-08-10' })).toBe(1);
    expect(rangeLength({ start: '2026-08-10', end: '2026-08-20' })).toBe(11);
  });

  it('counts a backwards range the same way', () => {
    expect(rangeLength({ start: '2026-08-20', end: '2026-08-10' })).toBe(11);
  });

  it('counts across a DST boundary without drifting', () => {
    // 29 March 2026 is a European spring-forward date; that day is 23h locally.
    expect(rangeLength({ start: '2026-03-28', end: '2026-03-30' })).toBe(3);
    expect(rangeLength({ start: '2026-01-01', end: '2026-12-31' })).toBe(365);
    expect(rangeLength({ start: '2024-01-01', end: '2024-12-31' })).toBe(366);
  });

  it('is zero while incomplete', () => {
    expect(rangeLength({ start: '2026-08-10', end: null })).toBe(0);
    expect(rangeLength({ start: null, end: null })).toBe(0);
  });
});

describe('eachDayInRange', () => {
  it('lists every day ascending, inclusive of both ends', () => {
    expect(eachDayInRange({ start: '2026-08-10', end: '2026-08-13' })).toEqual([
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
    ]);
  });

  it('lists a single day for a one-day range', () => {
    expect(eachDayInRange({ start: '2026-08-10', end: '2026-08-10' })).toEqual(['2026-08-10']);
  });

  it('ascends even when the range is backwards', () => {
    expect(eachDayInRange({ start: '2026-08-12', end: '2026-08-10' })).toEqual(['2026-08-10', '2026-08-11', '2026-08-12']);
  });

  it('is empty while incomplete', () => {
    expect(eachDayInRange({ start: '2026-08-10', end: null })).toEqual([]);
    expect(eachDayInRange({ start: null, end: null })).toEqual([]);
  });

  it('spans a month boundary contiguously', () => {
    const days = eachDayInRange({ start: '2026-08-30', end: '2026-09-02' });
    expect(days).toEqual(['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02']);
  });
});
