/**
 * Selection transitions, per-cell state, and focus movement — the interaction
 * half of the headless calendar, kept pure so it is unit-testable without a
 * renderer and reusable from a consumer's own reducer.
 *
 * Not exported from the package: the hooks in `hooks/use-calendar` and friends
 * are the public surface, and they return everything computed here. This module
 * exists to keep those hooks inside the 100-line-per-function cap and to let the
 * awkward cases (a reversed range, a keyboard step onto a disabled day) be
 * tested directly rather than through a render.
 */

import {
  addDays,
  addMonths,
  clampISO,
  type DateRange,
  type ISODate,
  isSameDay,
  isWithinBounds,
  isWithinRange,
  normalizeRange,
  weekdayOf,
} from './calendar';

// Declared ahead of the exports to satisfy `useExportsLast`.

/** How far one keyboard step moves, in days, for the grid's own axes. */
const DAY_STEP: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

/** The keys {@link nextFocusedDate} handles beyond the four arrows. */
const EDGE_KEYS: readonly string[] = ['Home', 'End', 'PageUp', 'PageDown'];

/** The flags {@link decorateDay} adds, so its input type can subtract exactly them. */
type DayFlags = {
  isToday: boolean;
  isSelected: boolean;
  isDisabled: boolean;
  isFocused: boolean;
  isInRange: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
  isPreview: boolean;
  isWeekend: boolean;
};

/**
 * Distinguishes the two selection shapes without a cast: a range is the only
 * object, single mode is a string or `null`.
 */
function isRangeSelection(selection: ISODate | null | DateRange): selection is DateRange {
  return selection !== null && typeof selection === 'object';
}

function isRangeEndpoint(date: ISODate, range: DateRange): boolean {
  return isSameDay(range.start, date) || isSameDay(range.end, date);
}

function weekBoundary(from: ISODate, weekStartsOn: number, edge: 'start' | 'end'): ISODate {
  const offset = (weekdayOf(from) - weekStartsOn + 7) % 7;
  return edge === 'start' ? addDays(from, -offset) : addDays(from, 6 - offset);
}

/** The resolved settings {@link resolveFocusTarget} needs — defaults already applied. */
type FocusTarget = Required<Pick<FocusMoveOptions, 'from' | 'key' | 'shiftKey' | 'weekStartsOn' | 'isRTL'>>;

/** The unclamped destination for a key, before `[minDate, maxDate]` is applied. */
function resolveFocusTarget({ from, key, shiftKey, weekStartsOn, isRTL }: FocusTarget): ISODate | null {
  const step = DAY_STEP[key];
  if (step !== undefined) {
    // Only the horizontal axis mirrors under RTL; up/down stay week-wise, since a
    // week always runs top-to-bottom regardless of writing direction.
    const horizontal = key === 'ArrowLeft' || key === 'ArrowRight';
    return addDays(from, isRTL && horizontal ? -step : step);
  }
  if (key === 'PageUp') return addMonths(from, shiftKey ? -12 : -1);
  if (key === 'PageDown') return addMonths(from, shiftKey ? 12 : 1);
  // Home/End are week-relative (the row's first/last cell), which is the grid
  // convention — not the month's first/last day, which is what a text field
  // would do.
  if (key === 'Home') return weekBoundary(from, weekStartsOn, 'start');
  if (key === 'End') return weekBoundary(from, weekStartsOn, 'end');
  return null;
}

/**
 * The empty range. A frozen shared constant so an "unset" range keeps a stable
 * identity across renders and cannot be mutated by a consumer.
 */
export const EMPTY_RANGE: DateRange = Object.freeze({ start: null, end: null });

/** Whether a day may be picked, given the bounds and the consumer's own predicate. */
export type DayAvailability = {
  minDate?: ISODate | null;
  maxDate?: ISODate | null;
  /** Called for every visible cell, so keep it cheap (or memoise it). */
  isDateDisabled?: (date: ISODate) => boolean;
};

/** Everything a consumer needs to render one cell. */
export type CalendarDayState = {
  date: ISODate;
  day: number;
  month: number;
  year: number;
  weekday: number;
  /** Belongs to an adjacent month. */
  outside: boolean;
  isToday: boolean;
  /** Single mode: the picked day. Range mode: either endpoint. */
  isSelected: boolean;
  isDisabled: boolean;
  /** The cell the keyboard would act on — the calendar's own focus cursor. */
  isFocused: boolean;
  /** Strictly between the endpoints, endpoints excluded. Always `false` in single mode. */
  isInRange: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
  /**
   * Inside the provisional range being previewed while the second endpoint is
   * still unchosen — hover on web, focus movement on native.
   */
  isPreview: boolean;
  isWeekend: boolean;
};

/** Whether `date` is selectable. Outside-month cells stay pickable; bounds decide. */
export function isDayDisabled(date: ISODate, availability: DayAvailability): boolean {
  const { minDate, maxDate, isDateDisabled } = availability;
  if (!isWithinBounds(date, minDate, maxDate)) return true;
  return isDateDisabled?.(date) === true;
}

/**
 * The next single-mode selection for a click on `date`.
 *
 * Clicking the selected day clears it when `deselectable`, which is what a
 * filter-style field wants; a required field passes `false` so the only way out
 * is picking another day.
 */
export function nextSingleSelection(current: ISODate | null, date: ISODate, deselectable: boolean): ISODate | null {
  if (deselectable && isSameDay(current, date)) return null;
  return date;
}

/**
 * The next range for a click on `date`, as the two-click cycle: first click sets
 * `start` and clears `end`, second click completes it.
 *
 * A completed range restarts from the new click rather than extending, which is
 * how every date-range field behaves — otherwise a third click silently widens a
 * range the user thought they were redoing.
 *
 * A second click *before* the start is accepted and normalised, so dragging
 * backwards works instead of being rejected.
 */
export function nextRangeSelection(current: DateRange, date: ISODate): DateRange {
  const { start, end } = current;
  if (start === null || end !== null) return { start: date, end: null };
  return normalizeRange({ start, end: date });
}

/**
 * The range to paint while the second endpoint is unchosen: the fixed `start`
 * paired with whatever the pointer or focus cursor is on.
 *
 * Returns `null` when there is nothing provisional to show, so a caller can tell
 * "no preview" from "a preview that happens to be one day".
 */
export function previewRange(current: DateRange, candidate: ISODate | null): DateRange | null {
  if (current.start === null || current.end !== null || candidate === null) return null;
  return normalizeRange({ start: current.start, end: candidate });
}

/** Options for {@link decorateDay}. */
export type DecorateDayOptions = {
  today: ISODate;
  /** Single mode: `ISODate | null`. Range mode: a {@link DateRange}. */
  selection: ISODate | null | DateRange;
  /** The provisional range from {@link previewRange}, if any. */
  preview: DateRange | null;
  focused: ISODate | null;
  availability: DayAvailability;
  /** Which weekdays read as the weekend. Default Saturday + Sunday. */
  weekendDays?: readonly number[];
};

/**
 * Turns a bare grid cell into the full {@link CalendarDayState}.
 *
 * `isInRange` deliberately excludes the endpoints: an endpoint is a different
 * visual (a filled pill) from the days between (a flat band), and a consumer
 * that wants "endpoint or inside" can ask for `isInRange || isSelected`. Making
 * it inclusive would leave no way back to the exclusive form.
 */
export function decorateDay(cell: Omit<CalendarDayState, keyof DayFlags>, options: DecorateDayOptions): CalendarDayState {
  const { today, selection, preview, focused, availability, weekendDays = [0, 6] } = options;
  const { date } = cell;
  // Split the union once, through the type guard, so neither branch needs a cast.
  const range = isRangeSelection(selection) ? normalizeRange(selection) : null;
  const single = isRangeSelection(selection) ? null : selection;

  const isSelected = range === null ? isSameDay(single, date) : isRangeEndpoint(date, range);
  const isRangeStart = range === null ? false : isSameDay(range.start, date);
  const isRangeEnd = range === null ? false : isSameDay(range.end, date);
  // Strictly inside, and only once both ends exist — a half-open range has no
  // interior to paint.
  const isInRange = range !== null && range.end !== null && isWithinRange(date, range) && !isRangeStart && !isRangeEnd;

  return {
    ...cell,
    isToday: isSameDay(date, today),
    isSelected,
    isDisabled: isDayDisabled(date, availability),
    isFocused: isSameDay(focused, date),
    isInRange,
    isRangeStart,
    isRangeEnd,
    isPreview: preview !== null && isWithinRange(date, preview),
    isWeekend: weekendDays.includes(cell.weekday),
  };
}

/** Options for {@link nextFocusedDate}. */
export type FocusMoveOptions = {
  from: ISODate;
  key: string;
  /** Set for `Shift+PageUp`/`Shift+PageDown`, which move by a year. */
  shiftKey?: boolean;
  /** Which column `Home`/`End` snap to. */
  weekStartsOn?: number;
  minDate?: ISODate | null;
  maxDate?: ISODate | null;
  /**
   * Mirrors the horizontal arrows, for an RTL grid where `ArrowRight` means
   * "earlier". The hooks take this from the caller rather than reading the
   * ambient direction, so this module stays free of React Native.
   */
  isRTL?: boolean;
};

/**
 * Where the focus cursor lands for a key, or `null` if the key is not one this
 * grid handles (so a caller knows not to swallow the event).
 *
 * The result is clamped into `[minDate, maxDate]` rather than refused: stepping
 * off the end of an allowed window should stop at the edge, not do nothing.
 * Disabled days *inside* the window still take focus — skipping them would make
 * a long blocked stretch impossible to cross with the keyboard, and a focused
 * day that cannot be picked is already conveyed by its disabled state.
 */
export function nextFocusedDate(options: FocusMoveOptions): ISODate | null {
  const { from, key, shiftKey = false, weekStartsOn = 0, minDate, maxDate, isRTL = false } = options;

  const target = resolveFocusTarget({ from, key, shiftKey, weekStartsOn, isRTL });
  return target === null ? null : clampISO(target, minDate, maxDate);
}

/** The keys {@link nextFocusedDate} responds to — useful for deciding whether to preventDefault. */
export function isCalendarNavigationKey(key: string): boolean {
  return Object.hasOwn(DAY_STEP, key) || EDGE_KEYS.includes(key);
}
