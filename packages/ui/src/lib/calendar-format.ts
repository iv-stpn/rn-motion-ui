/**
 * Localised labels for calendar UI — month headings, weekday column headers, and
 * the spoken date strings the accessibility contract requires.
 *
 * Split from `./calendar` on purpose: that module is pure arithmetic with no
 * dependencies, while everything here goes through `Intl`. Keeping them apart
 * means the date math can be used (and tested) without pulling in formatting,
 * and a consumer who wants their own i18n layer can ignore this file entirely.
 *
 * Every formatter is pinned to `timeZone: 'UTC'`, because {@link toUTCDate}
 * returns UTC midnight. Formatting that instant in the ambient zone would print
 * the previous day anywhere west of Greenwich.
 */

import { addDays, type DateRange, type ISODate, isoDate, normalizeRange, toUTCDate, type WeekStart } from './calendar';

// Declared ahead of the exports to satisfy `useExportsLast`.

/**
 * `Intl.DateTimeFormat` construction is the expensive part of formatting (locale
 * data resolution), and a calendar formats every visible cell on every render —
 * 42 cells for a fixed six-week grid. Constructing one formatter per call showed
 * up as the dominant cost, so they are cached by locale + options.
 *
 * The key set is bounded by the option shapes below times the locales in use, so
 * this cannot grow without bound in practice.
 */
const formatters = new Map<string, Intl.DateTimeFormat>();

/** A Sunday, used as the origin for generating weekday names. 1970-01-01 was a Thursday. */
const WEEKDAY_ORIGIN = isoDate(1970, 1, 4);

function localeKey(locale: CalendarLocale): string {
  if (locale === undefined) return '';
  return Array.isArray(locale) ? locale.join(',') : locale;
}

function formatter(locale: CalendarLocale, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${localeKey(locale)}|${JSON.stringify(options)}`;
  const cached = formatters.get(key);
  if (cached) return cached;
  const made = new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' });
  formatters.set(key, made);
  return made;
}

/**
 * A BCP 47 locale, or a list in priority order. `undefined` means the runtime
 * default, which is what an app that has not made a choice should get.
 */
export type CalendarLocale = string | string[] | undefined;

/** How wide a weekday column header should read. */
export type WeekdayWidth = 'narrow' | 'short' | 'long';

/** `'August 2026'` — the month heading. */
export function formatMonthLabel(month: ISODate, locale?: CalendarLocale): string {
  return formatter(locale, { month: 'long', year: 'numeric' }).format(toUTCDate(month));
}

/**
 * The seven weekday names, rotated to begin at `weekStartsOn`, so index `0` is
 * always the leftmost column of the grid.
 *
 * `narrow` is the single letter a compact calendar wants. It is deliberately not
 * unique — English gives `T` for both Tuesday and Thursday — so it belongs on a
 * decorative header whose accessible name comes from `long`, never as the only
 * label a screen reader can reach.
 */
export function formatWeekdayLabels(
  weekStartsOn: WeekStart = 0,
  locale?: CalendarLocale,
  width: WeekdayWidth = 'short',
): string[] {
  const format = formatter(locale, { weekday: width });
  return Array.from({ length: 7 }, (_unused, index) =>
    format.format(toUTCDate(addDays(WEEKDAY_ORIGIN, (weekStartsOn + index) % 7))),
  );
}

/**
 * `'Wednesday, August 5, 2026'` — the full spoken form.
 *
 * This is what a day cell's accessible name should be. The visible label is a
 * bare number, and "5" alone tells a screen reader user nothing about which
 * month or weekday they have landed on while arrowing through a grid.
 */
export function formatDayLabel(date: ISODate, locale?: CalendarLocale): string {
  return formatter(locale, { dateStyle: 'full' }).format(toUTCDate(date));
}

/** `'August 5, 2026'` — a selected date in a trigger or field, without the weekday. */
export function formatDateLabel(date: ISODate, locale?: CalendarLocale): string {
  return formatter(locale, { dateStyle: 'long' }).format(toUTCDate(date));
}

/**
 * A range as `'August 5, 2026 – August 12, 2026'`, or the one side that is set
 * while the selection is half-finished. Returns `''` for an empty range so it can
 * be dropped straight into a field value.
 */
export function formatRangeLabel(range: DateRange, locale?: CalendarLocale, separator = ' – '): string {
  // Normalised first, like `rangeLength` and `eachDayInRange`: a range picked
  // backwards (end clicked before start) is the same span, and reading it out as
  // "9 August – 5 August" would state it as an impossible one.
  const ordered = normalizeRange(range);
  const start = ordered.start === null ? '' : formatDateLabel(ordered.start, locale);
  const end = ordered.end === null ? '' : formatDateLabel(ordered.end, locale);
  if (start !== '' && end !== '') return `${start}${separator}${end}`;
  return start === '' ? end : start;
}
