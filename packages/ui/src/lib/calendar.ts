/**
 * Calendar date primitives — the pure core behind `useCalendar`,
 * `useDatePicker` and `useDateRangePicker`.
 *
 * Dates are plain `YYYY-MM-DD` strings. That choice is deliberate: a `Date` is
 * an *instant*, and a calendar cell is not — "the 5th" is the same cell whether
 * you are in Tokyo or Los Angeles. Passing `Date` objects around a calendar is
 * how the classic off-by-one appears, because the instant that renders as the
 * 5th locally is the 4th once it crosses UTC. An ISO day string has no such
 * ambiguity, compares correctly with `<`/`===` (it is lexicographically
 * ordered), and serialises to JSON unchanged.
 *
 * Everything here is pure, React-free and RN-free, so it is unit-testable on
 * its own and reusable from a consumer's own view layer.
 *
 * All arithmetic goes through UTC epoch milliseconds. Local-time arithmetic
 * loses or gains an hour across a DST boundary, which is enough to make
 * `addDays(iso, 1)` land back on the same day; at UTC midnight every day is
 * exactly 24h. The one function that *must* read local time is
 * {@link todayISO} — see its note.
 *
 * The arithmetic helpers assume a well-formed {@link ISODate}. Validate
 * untrusted input at the boundary with {@link isISODate} or
 * {@link parseISODate}.
 */

// Declared ahead of the exports to satisfy `useExportsLast`; the `ISODate` type
// alias they mention is hoisted, so referencing it early is fine.

const MS_PER_DAY = 86_400_000;
/** Shape gate only — `2026-02-30` matches this and is still rejected by {@link parseISODate}. */
const ISO_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** Epoch ms at UTC midnight of a civil date. Month is 1-based; out-of-range parts normalise. */
function toEpoch(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day);
}

function fromEpoch(ms: number): CalendarParts {
  const date = new Date(ms);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/**
 * Present-and-not-null. The bounds arguments below accept both spellings —
 * `undefined` for an omitted prop, `null` for a {@link DateRange} side that is
 * deliberately empty — and the lint config disallows the `!= null` shorthand
 * that would cover both at once.
 */
function isSet(value: ISODate | null | undefined): value is ISODate {
  return value !== null && value !== undefined;
}

function epochOf(iso: ISODate): number {
  return toEpoch(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), Number(iso.slice(8, 10)));
}

/**
 * A calendar day as `YYYY-MM-DD`.
 *
 * Kept a plain `string` alias rather than a branded type so consumers can pass
 * literals and `input.value` straight in without a cast. Use {@link isISODate}
 * where the value comes from outside your own code.
 */
export type ISODate = string;

/** An {@link ISODate} taken apart. `month` is 1-based, matching how a date reads aloud. */
export type CalendarParts = { year: number; month: number; day: number };

/** Day a week starts on: `0` Sunday … `6` Saturday. */
export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** A `{ start, end }` pair. Either side may be `null` while a selection is in progress. */
export type DateRange = { start: ISODate | null; end: ISODate | null };

/** One cell of a month grid. */
export type CalendarDay = {
  /** The cell's date, and a stable React key. */
  date: ISODate;
  /** Day of the month, 1–31. */
  day: number;
  /** Month, 1–12. */
  month: number;
  year: number;
  /** `0` Sunday … `6` Saturday, regardless of `weekStartsOn`. */
  weekday: number;
  /** True for the leading/trailing cells that belong to an adjacent month. */
  outside: boolean;
};

/** Builds an {@link ISODate}. Out-of-range parts normalise, so `(2026, 1, 32)` is `2026-02-01`. */
export function isoDate(year: number, month: number, day: number): ISODate {
  const parts = fromEpoch(toEpoch(year, month, day));
  return `${String(parts.year).padStart(4, '0')}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

/**
 * Parses a strict `YYYY-MM-DD`, or `null` if the shape is wrong or the date does
 * not exist. Unlike {@link isoDate} nothing normalises here: `2026-02-30` is
 * rejected rather than rolled forward, which is what validating a typed-in date
 * field needs.
 */
export function parseISODate(value: string): CalendarParts | null {
  const match = ISO_SHAPE.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1) return null;
  // Round-trip through the epoch: a day that overflowed its month comes back as
  // a different month, which is exactly the invalid case.
  const parts = fromEpoch(toEpoch(year, month, day));
  if (parts.year !== year || parts.month !== month || parts.day !== day) return null;
  return { year, month, day };
}

/** Whether `value` is a real calendar day in `YYYY-MM-DD` form. */
export function isISODate(value: unknown): value is ISODate {
  return typeof value === 'string' && parseISODate(value) !== null;
}

/**
 * The day as a `Date` at **UTC midnight** — the bridge to any API that speaks
 * `Date`, including `Intl.DateTimeFormat`.
 *
 * Always format the result with `timeZone: 'UTC'`. Formatting it in the ambient
 * zone re-introduces exactly the off-by-one this module exists to avoid: UTC
 * midnight on the 5th is the evening of the 4th anywhere west of Greenwich, so a
 * cell would be labelled with the wrong date.
 *
 * For the reverse direction — a local `Date` to the day it reads as — use
 * {@link todayISO}, which takes an optional `Date`.
 */
export function toUTCDate(iso: ISODate): Date {
  return new Date(epochOf(iso));
}

/**
 * Today's date **in the local calendar** — the day the user would name if asked.
 *
 * This is the one function here that reads local time, and it must. The instinct
 * is `new Date().toISOString().slice(0, 10)`, and that is wrong for roughly half
 * the planet for part of every day: at 23:00 on the 5th in Paris it is already
 * the 6th in UTC, so "today" would highlight tomorrow's cell.
 *
 * Pass `now` to pin it in tests.
 */
export function todayISO(now: Date = new Date()): ISODate {
  return isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/**
 * `-1` / `0` / `1`, like a sort comparator.
 *
 * A plain `<` on the strings would do — an ISO day string sorts correctly as
 * text — but going through it by name states the intent, and the fixed-width
 * format is the reason it holds, which is easy to break silently otherwise.
 */
export function compareISO(a: ISODate, b: ISODate): -1 | 0 | 1 {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Whether two dates are the same calendar day, tolerating `null`/`undefined` on either side. */
export function isSameDay(a: ISODate | null | undefined, b: ISODate | null | undefined): boolean {
  return isSet(a) && isSet(b) && a === b;
}

/** Whether the two dates fall in the same month of the same year. */
export function isSameMonth(a: ISODate, b: ISODate): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** Days in a 1-based month, leap years included. */
export function daysInMonth(year: number, month: number): number {
  return fromEpoch(toEpoch(year, month + 1, 0)).day;
}

/** Whether `year` is a leap year in the proleptic Gregorian calendar. */
export function isLeapYear(year: number): boolean {
  return daysInMonth(year, 2) === 29;
}

/** `0` Sunday … `6` Saturday. */
export function weekdayOf(iso: ISODate): number {
  return new Date(epochOf(iso)).getUTCDay();
}

/** Shifts by whole days. Exact across DST because it is UTC arithmetic. */
export function addDays(iso: ISODate, amount: number): ISODate {
  const parts = fromEpoch(epochOf(iso) + amount * MS_PER_DAY);
  return isoDate(parts.year, parts.month, parts.day);
}

/**
 * Shifts by whole months, **clamping the day to the target month's length** —
 * `addMonths('2026-01-31', 1)` is `2026-02-28`, not `2026-03-03`.
 *
 * Clamping rather than overflowing is what a month-navigation button needs: from
 * the 31st, `next` must land in the very next month, and letting the day roll
 * over would skip February entirely.
 */
export function addMonths(iso: ISODate, amount: number): ISODate {
  const { year, month, day } = fromEpoch(epochOf(iso));
  const shifted = fromEpoch(toEpoch(year, month + amount, 1));
  return isoDate(shifted.year, shifted.month, Math.min(day, daysInMonth(shifted.year, shifted.month)));
}

/** First day of `iso`'s month. */
export function startOfMonth(iso: ISODate): ISODate {
  return `${iso.slice(0, 7)}-01`;
}

/** Last day of `iso`'s month. */
export function endOfMonth(iso: ISODate): ISODate {
  const { year, month } = fromEpoch(epochOf(iso));
  return isoDate(year, month, daysInMonth(year, month));
}

/** Constrains `iso` to the inclusive `[min, max]` window. Absent bounds are unbounded. */
export function clampISO(iso: ISODate, min?: ISODate | null, max?: ISODate | null): ISODate {
  if (isSet(min) && iso < min) return min;
  if (isSet(max) && iso > max) return max;
  return iso;
}

/** Whether `iso` sits inside the inclusive `[min, max]` window. */
export function isWithinBounds(iso: ISODate, min?: ISODate | null, max?: ISODate | null): boolean {
  return (!isSet(min) || iso >= min) && (!isSet(max) || iso <= max);
}

/** Options for {@link buildMonthGrid}. */
export type MonthGridOptions = {
  /** Any date inside the month to build. */
  month: ISODate;
  /** Day the week starts on. Default `0` (Sunday). */
  weekStartsOn?: WeekStart;
  /**
   * Always emit six rows, padding with trailing outside days.
   *
   * A month's grid is 4–6 rows depending on its length and start weekday, so an
   * unpadded calendar changes height when you page through it, nudging whatever
   * sits below. Default `false`.
   */
  fixedWeeks?: boolean;
};

/**
 * The month of `month` as rows of seven cells, including the leading and
 * trailing `outside` days that fill the first and last weeks.
 *
 * Outside days are emitted rather than left as holes so a consumer can render a
 * complete 7-wide row without inserting spacers, and can choose to show, dim, or
 * hide them via {@link CalendarDay.outside}.
 */
export function buildMonthGrid({ month, weekStartsOn = 0, fixedWeeks = false }: MonthGridOptions): CalendarDay[][] {
  const first = startOfMonth(month);
  const { year, month: monthNumber } = fromEpoch(epochOf(first));
  // Cells before the 1st, so the 1st lands under its own weekday column.
  const lead = (weekdayOf(first) - weekStartsOn + 7) % 7;
  const span = lead + daysInMonth(year, monthNumber);
  const rows = fixedWeeks ? 6 : Math.ceil(span / 7);
  const gridStart = addDays(first, -lead);

  // Built as one flat run of days and then chunked, rather than nested
  // `Array.from`s: the offset is `index` alone, so there is no row/column
  // arithmetic to get wrong.
  const cells: CalendarDay[] = Array.from({ length: rows * 7 }, (_unused, index) => {
    const date = addDays(gridStart, index);
    const parts = fromEpoch(epochOf(date));
    return {
      date,
      day: parts.day,
      month: parts.month,
      year: parts.year,
      weekday: weekdayOf(date),
      outside: parts.month !== monthNumber || parts.year !== year,
    };
  });

  return Array.from({ length: rows }, (_unused, row) => cells.slice(row * 7, row * 7 + 7));
}

/** Orders a range so `start <= end`. A range with a missing side is returned unchanged. */
export function normalizeRange(range: DateRange): DateRange {
  const { start, end } = range;
  if (!(isSet(start) && isSet(end))) return range;
  return start <= end ? range : { start: end, end: start };
}

/** Whether both sides are set. */
export function isRangeComplete(range: DateRange): boolean {
  return isSet(range.start) && isSet(range.end);
}

/**
 * Whether `iso` falls inside `range`, inclusive of both ends.
 *
 * An incomplete range contains only the day already picked, so the first click
 * of a two-click selection highlights one cell rather than everything after it.
 */
export function isWithinRange(iso: ISODate, range: DateRange): boolean {
  const { start, end } = normalizeRange(range);
  if (isSet(start) && isSet(end)) return iso >= start && iso <= end;
  return isSameDay(iso, start ?? end);
}

/** Inclusive day count, or `0` while the range is incomplete. */
export function rangeLength(range: DateRange): number {
  const { start, end } = normalizeRange(range);
  if (!(isSet(start) && isSet(end))) return 0;
  return (epochOf(end) - epochOf(start)) / MS_PER_DAY + 1;
}

/** Every day in the range, ascending. Empty while the range is incomplete. */
export function eachDayInRange(range: DateRange): ISODate[] {
  const { start } = normalizeRange(range);
  const length = rangeLength(range);
  if (!isSet(start) || length === 0) return [];
  return Array.from({ length }, (_, index) => addDays(start, index));
}
