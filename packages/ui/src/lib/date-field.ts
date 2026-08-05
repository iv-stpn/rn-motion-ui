/**
 * The text-field half of a date picker: turning what someone typed into a date,
 * and a date back into what they see.
 *
 * Pure and React-free, so every rule here is assertable in a plain unit test.
 * The hooks own the state; this module owns the decisions.
 *
 * ## Why the default format is ISO
 *
 * A field the user can *type into* has to be round-trippable: whatever
 * `format` prints, `parse` must read back. A localised format is not — `'8/5/26'`
 * is August 5th in the US and May 8th almost everywhere else, and guessing wrong
 * silently books the wrong day. So the default is `'YYYY-MM-DD'` both ways, and a
 * consumer who wants a friendlier field passes their own pair (`Intl` for
 * `format`, their locale's rules for `parse`).
 *
 * Use `formatDateLabel` from `./calendar-format` for read-only display, where
 * there is nothing to parse back and a localised string is strictly nicer.
 */

import { type DateRange, type ISODate, isoDate, normalizeRange, parseISODate } from './calendar';
import { type DayAvailability, isDayDisabled } from './calendar-selection';

/** A lenient `YYYY-M-D`: single-digit month and day are accepted on the way in. */
const LOOSE_ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

/** How a field's text and its date are converted, in both directions. */
export type DateFieldFormat = {
  /** A date to the text shown in the field. */
  format: (date: ISODate) => string;
  /** Text to a date, or `null` when it is not one (yet). */
  parse: (text: string) => ISODate | null;
};

/** The identity direction: an `ISODate` is already `'YYYY-MM-DD'`. */
export function formatDateInput(date: ISODate): string {
  return date;
}

/**
 * Reads `'YYYY-MM-DD'`, forgiving the parts a person types on the way to it:
 * surrounding spaces, and a month or day without its leading zero. Returns
 * `null` for anything else, including a real-looking date that does not exist
 * (`'2026-02-30'`), so a caller never has to range-check the result.
 */
export function parseDateInput(text: string): ISODate | null {
  const match = LOOSE_ISO.exec(text.trim());
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const candidate = isoDate(year, month, day);
  // `isoDate` normalises an overflowing day instead of rejecting it, so the
  // round-trip is what actually rules out the 30th of February.
  const parts = parseISODate(candidate);
  if (parts === null || parts.year !== year || parts.month !== month || parts.day !== day) return null;
  return candidate;
}

/** The default pair: ISO in both directions, so the field always round-trips. */
export const ISO_DATE_FIELD: DateFieldFormat = { format: formatDateInput, parse: parseDateInput };

/**
 * What the field shows.
 *
 * The draft wins whenever there is one, so typing is never overwritten
 * mid-keystroke by a reformat of the committed value. `null` means "not being
 * edited", which is why it is not collapsed with the empty string — an empty
 * draft is a user who has just cleared the field.
 */
export function fieldText(draft: string | null, selected: ISODate | null, format: DateFieldFormat): string {
  if (draft !== null) return draft;
  return selected === null ? '' : format.format(selected);
}

/**
 * What committing the field's text should do.
 *
 * `'reject'` is deliberately distinct from `'clear'`: text that does not parse
 * must leave the existing selection alone and snap back to it, rather than
 * quietly discarding a date the user never asked to remove.
 */
export type FieldCommit =
  | { kind: 'clear' }
  | { kind: 'select'; date: ISODate }
  /** Unparseable, or a real date the calendar does not allow. */
  | { kind: 'reject' };

/** What {@link resolveFieldCommit} needs, as one object so it stays inside the 4-param cap. */
export type FieldCommitOptions = { text: string; format: DateFieldFormat; availability: DayAvailability };

/**
 * Decides a single field's commit. Empty text clears; a date outside the
 * calendar's own bounds is refused here too, so the field cannot smuggle in a
 * day a press could not have selected.
 */
export function resolveFieldCommit({ text, format, availability }: FieldCommitOptions): FieldCommit {
  if (text.trim() === '') return { kind: 'clear' };
  const date = format.parse(text);
  if (date === null || isDayDisabled(date, availability)) return { kind: 'reject' };
  return { kind: 'select', date };
}

/** Which end of a range a field edits. */
export type RangeField = 'start' | 'end';

/** What committing one of a range picker's two fields should do. */
export type RangeCommit = { kind: 'set'; range: DateRange } | { kind: 'reject' };

/** What {@link resolveRangeCommit} needs, as one object so it stays inside the 4-param cap. */
export type RangeCommitOptions = {
  range: DateRange;
  field: RangeField;
  text: string;
  format: DateFieldFormat;
  availability: DayAvailability;
};

/**
 * Decides one range field's commit, leaving the other end untouched.
 *
 * The result is normalised, so typing an end before the start reorders the range
 * rather than rejecting it — the same forgiveness the grid's second press gets.
 * Clearing one field empties only that end, which leaves a half-open range the
 * next press can complete.
 */
export function resolveRangeCommit(options: RangeCommitOptions): RangeCommit {
  const { range, field, text, format, availability } = options;
  const commit = resolveFieldCommit({ text, format, availability });
  if (commit.kind === 'reject') return { kind: 'reject' };
  const value = commit.kind === 'clear' ? null : commit.date;
  const next = field === 'start' ? { start: value, end: range.end } : { start: range.start, end: value };
  return { kind: 'set', range: normalizeRange(next) };
}
