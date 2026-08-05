/**
 * What is on screen: which months, which cell the cursor may stand on, and the
 * labels for both.
 *
 * The third pure layer under `hooks/use-calendar`, alongside `calendar-selection`
 * (what a click does) and `calendar-props` (what a cell spreads). Split out so the
 * hook body stays inside the per-function line cap and so the awkward cases —
 * a cursor stranded outside the window, a nav button at the edge of `[minDate,
 * maxDate]` — are testable without a renderer.
 *
 * Not exported from the package: `useCalendar` returns everything computed here.
 */

import {
  addMonths,
  buildMonthGrid,
  clampISO,
  compareISO,
  endOfMonth,
  type ISODate,
  isSameMonth,
  startOfMonth,
  type WeekStart,
} from './calendar';
import { type CalendarLocale, formatMonthLabel, formatWeekdayLabels } from './calendar-format';
import type { CalendarMonth, CalendarWeekday } from './calendar-props';
import { type DecorateDayOptions, decorateDay } from './calendar-selection';

/** What {@link buildMonth} needs beyond the anchor, as one object. */
export type MonthBuildOptions = {
  weekStartsOn: WeekStart;
  fixedWeeks: boolean;
  locale: CalendarLocale;
  decoration: DecorateDayOptions;
};

/** The month anchors on screen, starting at `anchor`, each anchored to the 1st. */
export function visibleMonths(anchor: ISODate, count: number): ISODate[] {
  const first = startOfMonth(anchor);
  return Array.from({ length: count }, (_unused, index) => addMonths(first, index));
}

/**
 * Whether stepping back reveals a month with any day at or after `minDate`.
 *
 * The whole revealed month is the test, not its 1st: with `minDate` mid-month the
 * previous month still holds selectable days, and disabling the button there would
 * strand them.
 */
export function canStepBack(first: ISODate, minDate: ISODate | null | undefined): boolean {
  if (minDate === null || minDate === undefined) return true;
  return compareISO(endOfMonth(addMonths(first, -1)), minDate) >= 0;
}

/** Whether stepping forward reveals a month with any day at or before `maxDate`. */
export function canStepForward(last: ISODate, maxDate: ISODate | null | undefined): boolean {
  if (maxDate === null || maxDate === undefined) return true;
  return compareISO(startOfMonth(addMonths(last, 1)), maxDate) <= 0;
}

/** Whether `date` falls in one of the months on screen. */
export function isInView(date: ISODate, view: ISODate[]): boolean {
  return view.some((month) => isSameMonth(month, date));
}

/**
 * The cell the keyboard acts on, which must be one that exists.
 *
 * The stored cursor can fall outside the window — a nav button moves the months
 * without moving it — and a cursor nobody renders would leave every cell at
 * `tabIndex={-1}`, making the grid unreachable by Tab. Clamping into the window
 * lands on the nearest edge day instead. Deliberately *not* clamped into
 * `[minDate, maxDate]`: a disabled day is still a legitimate place to stand, and
 * clamping twice could push the cursor back out of the window.
 */
export function focusTargetFor(focused: ISODate, view: ISODate[]): ISODate {
  const first = view[0];
  const last = view.at(-1);
  if (first === undefined || last === undefined) return focused;
  return clampISO(focused, startOfMonth(first), endOfMonth(last));
}

/**
 * The seven column headings, in all three widths, indexed left to right.
 *
 * All three because the choice is the consumer's: `narrow` is the single letter a
 * compact grid wants, and it is not unique (English gives `T` twice), so `long`
 * has to remain reachable as the accessible name.
 */
export function buildWeekdays(weekStartsOn: WeekStart, locale: CalendarLocale): CalendarWeekday[] {
  const narrow = formatWeekdayLabels(weekStartsOn, locale, 'narrow');
  const short = formatWeekdayLabels(weekStartsOn, locale, 'short');
  const long = formatWeekdayLabels(weekStartsOn, locale, 'long');
  return Array.from({ length: 7 }, (_unused, index) => ({
    weekday: (weekStartsOn + index) % 7,
    narrow: narrow[index] ?? '',
    short: short[index] ?? '',
    long: long[index] ?? '',
  }));
}

/** One month's decorated weeks, plus its heading. */
export function buildMonth(month: ISODate, options: MonthBuildOptions): CalendarMonth {
  const { weekStartsOn, fixedWeeks, locale, decoration } = options;
  // An adjacent month's day is drawn twice when several months are on screen, so
  // it never carries the cursor — two cells at `tabIndex={0}` would put a second
  // stop in the tab order for the same date.
  const outside = { ...decoration, focused: null };
  const weeks = buildMonthGrid({ month, weekStartsOn, fixedWeeks }).map((week) =>
    week.map((cell) => decorateDay(cell, cell.outside ? outside : decoration)),
  );
  return { month, label: formatMonthLabel(month, locale), weeks };
}

/** `'August 2026'`, or `'August 2026 – September 2026'` across several months. */
export function monthsLabel(view: ISODate[], locale: CalendarLocale): string {
  const first = view[0];
  const last = view.at(-1);
  if (first === undefined || last === undefined) return '';
  const start = formatMonthLabel(first, locale);
  return first === last ? start : `${start} – ${formatMonthLabel(last, locale)}`;
}
