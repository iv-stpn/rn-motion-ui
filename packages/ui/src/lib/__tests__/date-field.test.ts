/**
 * Tests for the date field's text layer.
 *
 * The interesting part is what the field refuses. `reject` and `clear` are
 * different outcomes with different consequences for the selection, and a date
 * that parses is not necessarily one that exists — so the cases below are mostly
 * about the boundary between "not a date yet" and "not a date at all".
 */
import { describe, expect, it } from 'vitest';

import type { DateRange } from '../calendar';
import type { DateFieldFormat, RangeField } from '../date-field';
import {
  fieldText,
  formatDateInput,
  ISO_DATE_FIELD,
  parseDateInput,
  resolveFieldCommit,
  resolveRangeCommit,
} from '../date-field';

/** Hoisted rather than built per parse: the rule against a regex in a hot function. */
const US_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/** A US-style format, to prove nothing downstream assumes the ISO default. */
const US_FIELD: DateFieldFormat = {
  format: (date) => {
    const [year, month, day] = date.split('-');
    return `${Number(month)}/${Number(day)}/${year}`;
  },
  parse: (text) => {
    const match = US_DATE.exec(text.trim());
    if (!match) return null;
    const [month, day, year] = [match[1], match[2], match[3]];
    return `${year}-${month?.padStart(2, '0')}-${day?.padStart(2, '0')}`;
  },
};

describe('parseDateInput', () => {
  it('reads a full ISO date', () => {
    expect(parseDateInput('2026-08-05')).toBe('2026-08-05');
  });

  it('forgives the parts a person types on the way to one', () => {
    expect(parseDateInput('  2026-8-5  ')).toBe('2026-08-05');
    expect(parseDateInput('2026-8-05')).toBe('2026-08-05');
  });

  it('rejects text that is not a date yet', () => {
    for (const text of ['', '2026', '2026-08', '2026-08-', 'tomorrow', '05/08/2026']) expect(parseDateInput(text)).toBeNull();
  });

  it('rejects a day the month does not have', () => {
    // `isoDate` would normalise the overflow to March 2nd; the round-trip is what
    // rules it out, so the caller never has to range-check the result.
    expect(parseDateInput('2026-02-30')).toBeNull();
    expect(parseDateInput('2026-04-31')).toBeNull();
    expect(parseDateInput('2026-13-01')).toBeNull();
  });

  it('accepts the 29th of February only in a leap year', () => {
    expect(parseDateInput('2028-02-29')).toBe('2028-02-29');
    expect(parseDateInput('2026-02-29')).toBeNull();
  });

  it('round-trips through the ISO pair', () => {
    expect(formatDateInput('2026-08-05')).toBe('2026-08-05');
    expect(ISO_DATE_FIELD.parse(ISO_DATE_FIELD.format('2026-08-05'))).toBe('2026-08-05');
  });
});

describe('fieldText', () => {
  it('shows the formatted selection when nothing is being typed', () => {
    expect(fieldText(null, '2026-08-05', ISO_DATE_FIELD)).toBe('2026-08-05');
    expect(fieldText(null, '2026-08-05', US_FIELD)).toBe('8/5/2026');
  });

  it('shows nothing when there is no selection', () => {
    expect(fieldText(null, null, ISO_DATE_FIELD)).toBe('');
  });

  it('lets the draft win, even an empty one', () => {
    // A draft is never overwritten mid-keystroke by a reformat of the committed
    // value, and `''` is a user who has just cleared the field — not "unedited".
    expect(fieldText('2026-0', '2026-08-05', ISO_DATE_FIELD)).toBe('2026-0');
    expect(fieldText('', '2026-08-05', ISO_DATE_FIELD)).toBe('');
  });
});

describe('resolveFieldCommit', () => {
  const commit = (text: string, availability = {}) => resolveFieldCommit({ text, format: ISO_DATE_FIELD, availability });

  it('selects a date it can read', () => {
    expect(commit('2026-08-05')).toEqual({ kind: 'select', date: '2026-08-05' });
  });

  it('clears on empty or blank text', () => {
    expect(commit('')).toEqual({ kind: 'clear' });
    expect(commit('   ')).toEqual({ kind: 'clear' });
  });

  it('rejects rather than clears when the text is not a date', () => {
    // The distinction matters: a reject must leave the existing selection alone.
    expect(commit('nonsense')).toEqual({ kind: 'reject' });
    expect(commit('2026-02-30')).toEqual({ kind: 'reject' });
  });

  it('rejects a real date the calendar does not allow', () => {
    expect(commit('2026-08-05', { minDate: '2026-08-10' })).toEqual({ kind: 'reject' });
    expect(commit('2026-08-05', { maxDate: '2026-08-01' })).toEqual({ kind: 'reject' });
    expect(commit('2026-08-05', { isDateDisabled: (date: string) => date === '2026-08-05' })).toEqual({ kind: 'reject' });
  });

  it('uses the format it is given', () => {
    const result = resolveFieldCommit({ text: '8/5/2026', format: US_FIELD, availability: {} });
    expect(result).toEqual({ kind: 'select', date: '2026-08-05' });
  });
});

describe('resolveRangeCommit', () => {
  const range: DateRange = { start: '2026-08-10', end: '2026-08-20' };
  const commit = (field: RangeField, text: string, from: DateRange = range) =>
    resolveRangeCommit({ range: from, field, text, format: ISO_DATE_FIELD, availability: {} });

  it('replaces one end and leaves the other alone', () => {
    expect(commit('start', '2026-08-12')).toEqual({ kind: 'set', range: { start: '2026-08-12', end: '2026-08-20' } });
    expect(commit('end', '2026-08-25')).toEqual({ kind: 'set', range: { start: '2026-08-10', end: '2026-08-25' } });
  });

  it('reorders rather than refusing when the ends cross', () => {
    // The same forgiveness the grid's second press gets.
    expect(commit('end', '2026-08-01')).toEqual({ kind: 'set', range: { start: '2026-08-01', end: '2026-08-10' } });
    expect(commit('start', '2026-08-30')).toEqual({ kind: 'set', range: { start: '2026-08-20', end: '2026-08-30' } });
  });

  it('empties only the end it was given', () => {
    expect(commit('start', '')).toEqual({ kind: 'set', range: { start: null, end: '2026-08-20' } });
    expect(commit('end', '   ')).toEqual({ kind: 'set', range: { start: '2026-08-10', end: null } });
  });

  it('completes a half-open range', () => {
    const half = { start: '2026-08-10', end: null };
    expect(commit('end', '2026-08-14', half)).toEqual({ kind: 'set', range: { start: '2026-08-10', end: '2026-08-14' } });
  });

  it('rejects the whole commit when the text is not a date', () => {
    expect(commit('start', 'nonsense')).toEqual({ kind: 'reject' });
  });

  it('rejects a date outside the bounds', () => {
    const options = { range, field: 'start', text: '2026-08-05', format: ISO_DATE_FIELD } as const;
    expect(resolveRangeCommit({ ...options, availability: { minDate: '2026-08-08' } })).toEqual({ kind: 'reject' });
  });
});
