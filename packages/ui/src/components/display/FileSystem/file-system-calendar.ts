// Date math behind the custom date range modal. Kept free of React Native
// imports so the month-grid and preset arithmetic can be unit tested directly.

const ISO_DATE_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const DAYS_PER_WEEK = 7;
const DAY_KEY_YEAR_SCALE = 10_000;
const DAY_KEY_MONTH_SCALE = 100;
const LAST_HOUR = 23;
const LAST_MINUTE = 59;
const LAST_SECOND = 59;
const LAST_MILLISECOND = 999;
const LAST_7_DAYS_OFFSET = 6;
const MONTHS_PER_QUARTER = 3;

/** Half-open range under construction — the calendar allows a start with no end yet. */
export type DateRangeDraft = { from?: Date; to?: Date };

/** A resolved range with both ends set. */
export type DateRange = { from: Date; to: Date };

/** Format a date as the `YYYY-MM-DD` the From/To fields display. */
export function formatDateInputValue(date: Date | undefined): string {
  if (!date) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Parse what someone typed into a From/To field. `YYYY-MM-DD` is read as a
 * local date (not UTC, which is what `new Date('2026-02-03')` would give);
 * anything else falls back to `Date.parse`.
 */
export function parseDateInputValue(value: string): Date | undefined {
  const trimmed = value.trim();
  if (!trimmed) return;

  const isoMatch = ISO_DATE_PATTERN.exec(trimmed);
  if (isoMatch) {
    const date = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? undefined : new Date(parsed);
}

/** Quick ranges offered under the calendar. */
export const DATE_RANGE_PRESETS = ['Last 7 days', 'This month', 'Last 1 month', 'Last 3 months', 'This year', 'Last 12 months'];

/** Resolve a preset to a whole-day range ending today. */
export function dateRangePresetRange(preset: string, now: Date = new Date()): DateRange {
  const from = new Date(now.getTime());
  const to = new Date(now.getTime());

  from.setHours(0, 0, 0, 0);
  to.setHours(LAST_HOUR, LAST_MINUTE, LAST_SECOND, LAST_MILLISECOND);

  switch (preset) {
    case 'Last 7 days':
      from.setDate(from.getDate() - LAST_7_DAYS_OFFSET);
      break;
    case 'This month':
      from.setDate(1);
      break;
    case 'Last 1 month':
      from.setMonth(from.getMonth() - 1);
      break;
    case 'Last 3 months':
      from.setMonth(from.getMonth() - MONTHS_PER_QUARTER);
      break;
    case 'This year':
      from.setMonth(0, 1);
      break;
    case 'Last 12 months':
      from.setFullYear(from.getFullYear() - 1);
      break;
    default:
      break;
  }

  return { from, to };
}

/** Widen a draft range to cover the full first and last day. */
export function wholeDayRange(from: Date, to: Date): DateRange {
  const start = new Date(from.getTime());
  const end = new Date(to.getTime());
  start.setHours(0, 0, 0, 0);
  end.setHours(LAST_HOUR, LAST_MINUTE, LAST_SECOND, LAST_MILLISECOND);
  return { from: start, to: end };
}

export const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * Collapse a date to a comparable day ordinal (`20260203`), so range checks
 * ignore the time of day without allocating.
 */
export function calendarDayKey(date: Date): number {
  return date.getFullYear() * DAY_KEY_YEAR_SCALE + date.getMonth() * DAY_KEY_MONTH_SCALE + date.getDate();
}

/** First day of the month `date` falls in. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Shift a month anchor by `delta` months. */
export function addMonths(month: Date, delta: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + delta, 1);
}

/** `'February 2026'` heading for a month grid. */
export function monthLabel(month: Date): string {
  return month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** One grid slot: a day, or a leading/trailing blank that pads the week. */
export type CalendarCell = { day: Date | null; key: string };

/** One row of the month grid. */
export type CalendarWeek = { cells: CalendarCell[]; key: string };

/**
 * The cells of one month grid, padded so the first day lands under its weekday
 * and the last week stays seven wide. Rows come pre-chunked into weeks because
 * RN has no CSS grid — each week becomes a flex row. Keys are assigned here so
 * the render layer never has to key off an array index.
 */
export function monthWeeks(month: Date): CalendarWeek[] {
  const monthKey = `${month.getFullYear()}-${month.getMonth()}`;
  const firstWeekday = month.getDay();
  const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  const cells: CalendarCell[] = [
    ...Array.from({ length: firstWeekday }, (_unused, index) => ({ day: null, key: `${monthKey}-lead-${index}` })),
    ...Array.from({ length: dayCount }, (_unused, index) => {
      const day = new Date(month.getFullYear(), month.getMonth(), index + 1);
      return { day, key: `${monthKey}-${index + 1}` };
    }),
  ];

  while (cells.length % DAYS_PER_WEEK !== 0) cells.push({ day: null, key: `${monthKey}-trail-${cells.length}` });

  return Array.from({ length: cells.length / DAYS_PER_WEEK }, (_unused, weekIndex) => ({
    cells: cells.slice(weekIndex * DAYS_PER_WEEK, (weekIndex + 1) * DAYS_PER_WEEK),
    key: `${monthKey}-week-${weekIndex}`,
  }));
}

/**
 * Apply a day press to the draft range: first press sets the start, the next
 * sets the end, a press before the start swaps the ends, and a press once both
 * are set restarts the range.
 */
export function nextRangeForDayPress(range: DateRangeDraft, day: Date): DateRangeDraft {
  if (!range.from || range.to) return { from: day };
  if (calendarDayKey(day) < calendarDayKey(range.from)) return { from: day, to: range.from };
  return { from: range.from, to: day };
}
