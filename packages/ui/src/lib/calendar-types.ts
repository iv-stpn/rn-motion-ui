/**
 * The option and result types for `useCalendar`.
 *
 * They live beside the hook rather than inside it only to keep that file under the
 * line cap. Nothing here is React-aware, so this module stays importable from a
 * plain test. Consumers should reach these through `hooks/use-calendar`, which
 * re-exports every one of them.
 */

import type { DateRange, ISODate, WeekStart } from './calendar';
import type { CalendarLocale } from './calendar-format';
import type { CalendarGetters, CalendarMonth, CalendarWeekday } from './calendar-props';

/** Which selection shape the grid maintains. */
export type CalendarMode = 'single' | 'range';

/** Accessible names, for translation. */
export type CalendarLabels = { previousMonth?: string; nextMonth?: string; calendar?: string };

/** Options for `useCalendar`. Every field is optional: the bare hook is a working month grid. */
export type UseCalendarOptions = {
  /** Default `'single'`. */
  mode?: CalendarMode;
  /**
   * Controlled single selection. Omit to let the hook own it; `null` is a
   * controlled empty selection, which is why the two are not collapsed.
   */
  selectedDate?: ISODate | null;
  defaultSelectedDate?: ISODate | null;
  onSelectDate?: (date: ISODate | null) => void;
  /** Controlled range selection, used when `mode` is `'range'`. */
  selectedRange?: DateRange;
  defaultSelectedRange?: DateRange;
  onSelectRange?: (range: DateRange) => void;
  /** Controlled leftmost visible month. Any day in it works; it is anchored to the 1st. */
  month?: ISODate;
  defaultMonth?: ISODate;
  onMonthChange?: (month: ISODate) => void;
  /** Months laid out side by side. Default `1`; a range picker usually wants `2`. */
  numberOfMonths?: number;
  /** Default `0` (Sunday). */
  weekStartsOn?: WeekStart;
  /** Pad every month to six rows, so the grid keeps one height. Default `false`. */
  fixedWeeks?: boolean;
  minDate?: ISODate | null;
  maxDate?: ISODate | null;
  /** Called for every visible cell, so keep it cheap (or memoise it). */
  isDateDisabled?: (date: ISODate) => boolean;
  /** Which weekdays read as the weekend. Default Saturday + Sunday. */
  weekendDays?: readonly number[];
  /** Single mode: pressing the selected day clears it. Default `false`. */
  deselectable?: boolean;
  /** Mirrors the horizontal arrow keys for an RTL grid — pass `useIsRTL()`. */
  isRTL?: boolean;
  /** Forwarded to `Intl`. Omit for the runtime's own locale. */
  locale?: CalendarLocale;
  /** Overrides `todayISO()`, for tests and for a clock fixed by the server. */
  today?: ISODate;
  labels?: CalendarLabels;
  /** Children derive their own testIDs from this; nothing is emitted without it. */
  testID?: string;
};

/** The state half of `useCalendar`'s result. */
export type CalendarState = {
  /** One entry per visible month, each with its heading and its weeks of cells. */
  months: CalendarMonth[];
  /** The seven column headings, already rotated to `weekStartsOn`. */
  weekdays: CalendarWeekday[];
  /** The leftmost visible month, anchored to the 1st. */
  month: ISODate;
  /** `null` in range mode. */
  selectedDate: ISODate | null;
  /** `EMPTY_RANGE` in single mode. */
  selectedRange: DateRange;
  /**
   * The cell the keyboard would act on.
   *
   * Not necessarily the cell holding platform focus: on first render nothing is
   * focused yet. Do not paint a focus ring from this alone — use the `focused`
   * state a `Pressable` already gives you, and treat this as the tab stop.
   */
  focusedDate: ISODate;
  today: ISODate;
  canGoToPreviousMonth: boolean;
  canGoToNextMonth: boolean;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  /** Jumps the view to any month. */
  goToMonth: (month: ISODate) => void;
  /** Jumps the view to today and puts the cursor on it. */
  goToToday: () => void;
  /** Selects a day directly, subject to the same bounds a press is. */
  selectDate: (date: ISODate) => void;
  /**
   * Sets both endpoints at once — range mode only, ignored in single mode.
   *
   * `selectDate` can only walk the two-step press loop, so this is the way to
   * apply a range that arrives whole: a preset like "last 7 days", or two text
   * fields. Normalised on the way in, and refused outright if either endpoint is
   * disabled.
   */
  setRange: (range: DateRange) => void;
  /** Empties the selection in whichever mode is active. */
  clearSelection: () => void;
};

/** What `useCalendar` returns: its state, plus the prop getters. */
export type UseCalendarReturn = CalendarState & CalendarGetters;
