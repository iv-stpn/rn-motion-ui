/**
 * Tests for the Intl formatting layer.
 *
 * These assert *structural* facts (ordering, length, rotation, UTC-correctness)
 * and only pin exact strings for `en-US`, whose CLDR forms are stable. Asserting
 * exact localised text for every locale would turn a CLDR data bump in Node into
 * a failing build here, which says nothing about this code.
 *
 * The property worth guarding hardest is that nothing shifts by a day: every
 * formatter is pinned to UTC, and a formatter that forgot that renders the 1st
 * as the previous month's last day for any tester west of Greenwich.
 */
import { describe, expect, it } from 'vitest';
import { formatDayLabel, formatMonthLabel, formatRangeLabel, formatWeekdayLabels } from '../calendar-format';

describe('formatMonthLabel', () => {
  it('names the month and year of the date given', () => {
    expect(formatMonthLabel('2026-08-05', 'en-US')).toBe('August 2026');
  });

  it('reads the month from the date, not from the day-of-month', () => {
    expect(formatMonthLabel('2026-01-01', 'en-US')).toBe('January 2026');
    expect(formatMonthLabel('2026-01-31', 'en-US')).toBe('January 2026');
    expect(formatMonthLabel('2026-12-31', 'en-US')).toBe('December 2026');
  });

  it('does not shift the first of the month into the previous one', () => {
    // The UTC-pinning regression test. With a local-time formatter this reads
    // "December 2025" in any timezone west of UTC.
    expect(formatMonthLabel('2026-01-01', 'en-US')).toContain('January');
  });

  it('formats a locale with a different month/year order', () => {
    // ja-JP puts the year first; assert that rather than a literal string.
    const label = formatMonthLabel('2026-08-05', 'ja-JP');
    expect(label).toContain('2026');
    expect(label.indexOf('2026')).toBe(0);
  });
});

describe('formatWeekdayLabels', () => {
  it('returns seven labels', () => {
    expect(formatWeekdayLabels(0, 'en-US')).toHaveLength(7);
  });

  it('starts on Sunday for weekStartsOn 0', () => {
    expect(formatWeekdayLabels(0, 'en-US', 'long')).toEqual([
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ]);
  });

  it('rotates to Monday for weekStartsOn 1', () => {
    const labels = formatWeekdayLabels(1, 'en-US', 'long');
    expect(labels[0]).toBe('Monday');
    expect(labels[6]).toBe('Sunday');
  });

  it('rotates to Saturday for weekStartsOn 6', () => {
    const labels = formatWeekdayLabels(6, 'en-US', 'long');
    expect(labels[0]).toBe('Saturday');
    expect(labels[1]).toBe('Sunday');
  });

  it('is a rotation, not a re-order — the cyclic sequence is preserved', () => {
    const sunday = formatWeekdayLabels(0, 'en-US', 'long');
    for (const start of [0, 1, 2, 3, 4, 5, 6] as const) {
      const rotated = formatWeekdayLabels(start, 'en-US', 'long');
      expect(rotated).toEqual([...sunday.slice(start), ...sunday.slice(0, start)]);
    }
  });

  it('emits distinct labels in every supported format', () => {
    for (const format of ['narrow', 'short', 'long'] as const) {
      const labels = formatWeekdayLabels(1, 'en-US', format);
      expect(labels).toHaveLength(7);
      // `narrow` legitimately repeats in English (T/T, S/S), so only the wider
      // two are required to be unique.
      if (format !== 'narrow') expect(new Set(labels).size).toBe(7);
    }
  });

  it('produces short labels no longer than long ones', () => {
    const short = formatWeekdayLabels(0, 'en-US', 'short');
    const long = formatWeekdayLabels(0, 'en-US', 'long');
    expect(long).toHaveLength(short.length);
    for (const [index, label] of short.entries()) {
      const longLabel = long[index];
      expect(longLabel).toBeDefined();
      expect(label.length).toBeLessThanOrEqual(longLabel?.length ?? 0);
    }
  });

  it('localises', () => {
    const labels = formatWeekdayLabels(1, 'fr-FR', 'long');
    expect(labels).toHaveLength(7);
    expect(labels[0]).toBe('lundi');
  });
});

describe('formatDayLabel', () => {
  it('spells out the full date for a screen reader', () => {
    expect(formatDayLabel('2026-08-05', 'en-US')).toBe('Wednesday, August 5, 2026');
  });

  it('reports the correct weekday', () => {
    // 2026-08-05 is a Wednesday; the two neighbours bracket it.
    expect(formatDayLabel('2026-08-04', 'en-US')).toContain('Tuesday');
    expect(formatDayLabel('2026-08-06', 'en-US')).toContain('Thursday');
  });

  it('does not shift across the UTC boundary', () => {
    // 2026-01-01 is a Thursday. A local-time formatter would say Wednesday, Dec 31
    // for any negative UTC offset.
    const label = formatDayLabel('2026-01-01', 'en-US');
    expect(label).toContain('January');
    expect(label).toContain('2026');
    expect(label).toContain('Thursday');
  });

  it('handles a leap day', () => {
    expect(formatDayLabel('2024-02-29', 'en-US')).toContain('February 29');
  });

  it('localises', () => {
    expect(formatDayLabel('2026-08-05', 'fr-FR')).toContain('août');
  });
});

describe('formatRangeLabel', () => {
  it('joins both ends when the range is complete', () => {
    const label = formatRangeLabel({ start: '2026-08-05', end: '2026-08-09' }, 'en-US');
    expect(label).toContain('August 5');
    expect(label).toContain('August 9');
  });

  it('normalises a backwards range before formatting', () => {
    const forwards = formatRangeLabel({ start: '2026-08-05', end: '2026-08-09' }, 'en-US');
    const backwards = formatRangeLabel({ start: '2026-08-09', end: '2026-08-05' }, 'en-US');
    expect(backwards).toBe(forwards);
  });

  it('describes a half-open range as a start with no end', () => {
    const label = formatRangeLabel({ start: '2026-08-05', end: null }, 'en-US');
    expect(label).toContain('August 5');
    expect(label).not.toContain('August 9');
  });

  it('describes an end with no start', () => {
    const label = formatRangeLabel({ start: null, end: '2026-08-09' }, 'en-US');
    expect(label).toContain('August 9');
  });

  it('returns an empty string for an empty range', () => {
    expect(formatRangeLabel({ start: null, end: null }, 'en-US')).toBe('');
  });

  it('formats a single-day range', () => {
    const label = formatRangeLabel({ start: '2026-08-05', end: '2026-08-05' }, 'en-US');
    expect(label).toContain('August 5');
  });

  it('spans a year boundary', () => {
    const label = formatRangeLabel({ start: '2025-12-30', end: '2026-01-02' }, 'en-US');
    expect(label).toContain('2025');
    expect(label).toContain('2026');
  });
});
