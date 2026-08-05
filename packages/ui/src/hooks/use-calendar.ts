/**
 * The headless calendar grid: month navigation, selection, a keyboard cursor, and
 * the prop getters that carry all of it onto a consumer's own elements.
 *
 * This hook renders nothing and styles nothing. It owns the parts that are easy to
 * get subtly wrong — DST-safe date arithmetic, a roving tabindex, focus that
 * follows the cursor across a month boundary, range previews — and leaves every
 * visual decision to the caller.
 *
 * It imports no `react-native`, so it loads in a bare jsdom test. That is also why
 * `isRTL` is an option rather than a `useIsRTL()` call inside: pass `useIsRTL()`
 * from the component that renders the grid to make the horizontal arrows mirror.
 *
 * @example
 * ```tsx
 * const calendar = useCalendar({ onSelectDate: setDate, testID: 'birthday' });
 *
 * <View {...calendar.getRootProps()}>
 *   <Pressable {...calendar.getPreviousMonthProps()}><Text>‹</Text></Pressable>
 *   {calendar.months.map(({ month, label, weeks }) => (
 *     <View key={month} {...calendar.getMonthProps(month)}>
 *       <Text {...calendar.getMonthLabelProps(month)}>{label}</Text>
 *       <View {...calendar.getWeekdayRowProps(month)}>
 *         {calendar.weekdays.map((weekday) => (
 *           <Text key={weekday.weekday} {...calendar.getWeekdayProps(weekday, month)}>{weekday.narrow}</Text>
 *         ))}
 *       </View>
 *       {weeks.map((week, index) => (
 *         <View key={String(index)} {...calendar.getWeekProps(month, index)}>
 *           {week.map((day) => (
 *             <Pressable key={day.date} {...calendar.getDayProps(day)}>
 *               <Text>{day.day}</Text>
 *             </Pressable>
 *           ))}
 *         </View>
 *       ))}
 *     </View>
 *   ))}
 *   <Pressable {...calendar.getNextMonthProps()}><Text>›</Text></Pressable>
 * </View>
 * ```
 */

import { useMemo, useRef, useState } from 'react';

import { addMonths, clampISO, type DateRange, type ISODate, normalizeRange, startOfMonth, todayISO } from '../lib/calendar';
import { buildGetters, type FocusableNode, type WebKeyEvent } from '../lib/calendar-props';
import {
  type DayAvailability,
  EMPTY_RANGE,
  isCalendarNavigationKey,
  isDayDisabled,
  nextFocusedDate,
  nextRangeSelection,
  nextSingleSelection,
  previewRange,
} from '../lib/calendar-selection';
import type { UseCalendarOptions, UseCalendarReturn } from '../lib/calendar-types';
import {
  buildMonth,
  buildWeekdays,
  canStepBack,
  canStepForward,
  focusTargetFor,
  isInView,
  monthsLabel,
  visibleMonths,
} from '../lib/calendar-view';

// Declared ahead of the exports to satisfy `useExportsLast`.

/** A value that is the consumer's when they pass one, and ours otherwise. */
type Controlled<T> = { value: T; setValue: (next: T) => void };

/**
 * The controlled/uncontrolled seam. `undefined` means "you are not controlling
 * this"; `null` is a controlled *empty* selection, which is why the two are not
 * collapsed into one falsy check.
 */
function useControlled<T>(controlled: T | undefined, initial: T, onChange?: (next: T) => void): Controlled<T> {
  const [internal, setInternal] = useState<T>(initial);
  return {
    value: controlled === undefined ? internal : controlled,
    setValue: (next: T) => {
      if (controlled === undefined) setInternal(next);
      onChange?.(next);
    },
  };
}

/** The day nodes on screen, and the pending request to move real focus into one. */
type FocusCursor = {
  registerNode: (date: ISODate, node: FocusableNode | null) => void;
  requestFocus: (date: ISODate) => void;
};

/**
 * Moves real focus to follow the grid cursor.
 *
 * Without this an arrow key would move only the *visual* cursor: the platform's
 * focus would stay on whichever cell was tabbed into, so a screen reader would
 * announce nothing and `Enter` would act on the wrong day.
 *
 * Two paths, because the destination may not exist yet — stepping off the end of
 * a month mounts the next one. A cell already on screen is focused straight away;
 * one that is not is remembered, and focused by its own `ref` callback the moment
 * it attaches. No effect either way, so focus lands in the same commit.
 */
function useFocusCursor(): FocusCursor {
  const nodes = useRef(new Map<ISODate, FocusableNode>());
  const pending = useRef<ISODate | null>(null);

  const registerNode = (date: ISODate, node: FocusableNode | null) => {
    if (node === null) {
      nodes.current.delete(date);
      return;
    }
    nodes.current.set(date, node);
    // The cell the cursor was waiting for has just arrived.
    if (pending.current !== date) return;
    pending.current = null;
    node.focus?.();
  };

  const requestFocus = (date: ISODate) => {
    const node = nodes.current.get(date);
    if (node?.focus === undefined) {
      pending.current = date;
      return;
    }
    node.focus();
  };

  return { registerNode, requestFocus };
}

/** The selection in both shapes, plus the transitions that change it. */
type SelectionState = {
  selectedDate: ISODate | null;
  selectedRange: DateRange;
  /** The union `decorateDay` takes: the range in range mode, the day in single mode. */
  selected: ISODate | null | DateRange;
  selectDate: (date: ISODate) => void;
  setRange: (range: DateRange) => void;
  clearSelection: () => void;
};

/**
 * Both selection shapes behind one interface.
 *
 * They stay separate fields rather than one polymorphic `value` so a consumer of
 * either mode gets a precisely typed callback, instead of a union to narrow at
 * every call site. The unused shape reads as empty rather than stale.
 */
function useSelection(options: UseCalendarOptions, availability: DayAvailability): SelectionState {
  const { mode = 'single', deselectable = false } = options;
  const single = useControlled(options.selectedDate, options.defaultSelectedDate ?? null, options.onSelectDate);
  const range = useControlled(options.selectedRange, options.defaultSelectedRange ?? EMPTY_RANGE, options.onSelectRange);
  const isRange = mode === 'range';

  return {
    selectedDate: isRange ? null : single.value,
    selectedRange: isRange ? range.value : EMPTY_RANGE,
    selected: isRange ? range.value : single.value,
    selectDate: (date) => {
      // Checked here and not only in the press handler, so a programmatic
      // `selectDate` cannot put an out-of-bounds day into the selection either.
      if (isDayDisabled(date, availability)) return;
      if (isRange) range.setValue(nextRangeSelection(range.value, date));
      else single.setValue(nextSingleSelection(single.value, date, deselectable));
    },
    setRange: (next) => {
      if (!isRange) return;
      // All-or-nothing, like `selectDate`: a range with one blocked endpoint is
      // refused outright rather than silently trimmed to its allowed part, which
      // would hand back a range nobody asked for.
      const blocked = [next.start, next.end].some((date) => date !== null && isDayDisabled(date, availability));
      if (blocked) return;
      range.setValue(normalizeRange(next));
    },
    clearSelection: () => {
      if (isRange) range.setValue(EMPTY_RANGE);
      else single.setValue(null);
    },
  };
}

/** The months on screen, and the stepping that changes them. */
type MonthViewState = {
  view: ISODate[];
  month: ISODate;
  canGoToPreviousMonth: boolean;
  canGoToNextMonth: boolean;
  goToMonth: (month: ISODate) => void;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
};

/**
 * Which months are on screen.
 *
 * Stepping moves by one month even when several are shown, which is what a
 * two-month range picker wants: paging by two would carry away both of the months
 * the user was just comparing.
 */
function useMonthView(options: UseCalendarOptions, anchor: ISODate): MonthViewState {
  const controlled = useControlled(options.month, anchor, options.onMonthChange);
  const view = visibleMonths(controlled.value, Math.max(1, options.numberOfMonths ?? 1));
  const month = view[0] ?? startOfMonth(controlled.value);
  const last = view.at(-1) ?? month;
  // Anchored to the 1st on the way out, so `onMonthChange` never hands back a
  // mid-month date the caller has to normalise itself.
  const goToMonth = (next: ISODate) => controlled.setValue(startOfMonth(next));

  return {
    view,
    month,
    canGoToPreviousMonth: canStepBack(month, options.minDate),
    canGoToNextMonth: canStepForward(last, options.maxDate),
    goToMonth,
    goToPreviousMonth: () => goToMonth(addMonths(month, -1)),
    goToNextMonth: () => goToMonth(addMonths(month, 1)),
  };
}

/**
 * A month grid with selection, keyboard navigation and accessible props — and no
 * opinion about how any of it looks.
 *
 * Uncontrolled by default. Pass `selectedDate`/`onSelectDate` (or the `Range`
 * pair) to drive it from your own state, and `month`/`onMonthChange` to drive the
 * view.
 */
export function useCalendar(options: UseCalendarOptions = {}): UseCalendarReturn {
  const { weekStartsOn = 0, locale, testID } = options;
  const today = options.today ?? todayISO();
  const availability = { minDate: options.minDate, maxDate: options.maxDate, isDateDisabled: options.isDateDisabled };

  const selection = useSelection(options, availability);
  // The month first shown: whatever the caller asked for, else the month holding
  // the selection, else the month holding today.
  const anchor = options.defaultMonth ?? selection.selectedDate ?? selection.selectedRange.start ?? today;
  const view = useMonthView(options, anchor);

  const cursor = useFocusCursor();
  const [stored, setStored] = useState<ISODate>(() => clampISO(anchor, options.minDate, options.maxDate));
  const [hovered, setHovered] = useState<ISODate | null>(null);
  const focusedDate = focusTargetFor(stored, view.view);

  /** Moves the cursor, pulling the view along if the target is off screen. */
  const focusDate = (date: ISODate) => {
    setStored(date);
    if (!isInView(date, view.view)) view.goToMonth(date);
    cursor.requestFocus(date);
  };

  const onKeyDown = (event: WebKeyEvent) => {
    if (!isCalendarNavigationKey(event.key)) return;
    const next = nextFocusedDate({
      from: focusedDate,
      key: event.key,
      shiftKey: event.shiftKey ?? false,
      weekStartsOn,
      minDate: options.minDate,
      maxDate: options.maxDate,
      isRTL: options.isRTL ?? false,
    });
    if (next === null) return;
    // Only now: an unhandled key must keep its default (Tab still leaves the grid).
    event.preventDefault();
    focusDate(next);
  };

  const weekdays = useMemo(() => buildWeekdays(weekStartsOn, locale), [weekStartsOn, locale]);
  const decoration = {
    today,
    selection: selection.selected,
    // Range mode only: the band that follows the pointer, or the keyboard cursor
    // when there is no pointer, while the second endpoint is unchosen.
    preview: options.mode === 'range' ? previewRange(selection.selectedRange, hovered ?? focusedDate) : null,
    focused: focusedDate,
    availability,
    weekendDays: options.weekendDays,
  };

  return {
    ...selection,
    months: view.view.map((month) =>
      buildMonth(month, { weekStartsOn, fixedWeeks: options.fixedWeeks ?? false, locale, decoration }),
    ),
    weekdays,
    month: view.month,
    focusedDate,
    today,
    canGoToPreviousMonth: view.canGoToPreviousMonth,
    canGoToNextMonth: view.canGoToNextMonth,
    goToPreviousMonth: view.goToPreviousMonth,
    goToNextMonth: view.goToNextMonth,
    goToMonth: view.goToMonth,
    goToToday: () => focusDate(clampISO(today, options.minDate, options.maxDate)),
    ...buildGetters({
      testID,
      locale,
      rootLabel: options.labels?.calendar ?? monthsLabel(view.view, locale),
      navLabels: {
        previous: options.labels?.previousMonth ?? 'Previous month',
        next: options.labels?.nextMonth ?? 'Next month',
      },
      canGoToPreviousMonth: view.canGoToPreviousMonth,
      canGoToNextMonth: view.canGoToNextMonth,
      goToPreviousMonth: view.goToPreviousMonth,
      goToNextMonth: view.goToNextMonth,
      dayHandlers: {
        // Selection and the cursor move together: clicking a day makes it the
        // keyboard's day too, so the next arrow key steps from where you clicked.
        onPress: (date) => {
          selection.selectDate(date);
          focusDate(date);
        },
        // The platform moved focus itself (a click, or Tab into the grid), so the
        // cursor follows rather than fighting it.
        onFocus: (date) => setStored(date),
        onHoverIn: (date) => setHovered(date),
        onHoverOut: () => setHovered(null),
        onKeyDown,
        registerNode: cursor.registerNode,
      },
    }),
  };
}

// The option and result types live in `../lib/calendar-types` to keep this file
// under the line cap, but this module is where consumers should reach them.
export type {
  CalendarLabels,
  CalendarMode,
  CalendarState,
  UseCalendarOptions,
  UseCalendarReturn,
} from '../lib/calendar-types';
