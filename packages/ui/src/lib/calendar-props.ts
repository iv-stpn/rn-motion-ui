/**
 * The prop objects the headless calendar hands to a consumer, plus the pure
 * builders that shape them.
 *
 * Split out of `hooks/use-calendar` so the shapes are assertable in a unit test
 * without a renderer, and so the hook body stays inside the per-function line
 * cap. Nothing here imports React or `react-native`: the prop types are
 *structural*, declared with literal-typed accessibility fields, so each object
 * spreads onto a `Pressable` or `View` by assignability while this module stays
 * loadable in bare jsdom.
 *
 * ## What the props claim, and what they deliberately do not
 *
 * A day cell is a **button**, not a `gridcell`. The full ARIA date-grid pattern
 * (`grid` → `row` → `gridcell`) is out of reach: React Native's `Role` union has
 * no `gridcell`, and a `grid` whose children are buttons is an *invalid* grid —
 * worse than claiming nothing, since assistive tech would then walk a structure
 * whose cells it cannot find. So the grid is a plain group of buttons, each named
 * with its full spoken date (`'Wednesday, August 5, 2026'`), which is also what a
 * mobile screen reader wants. A consumer who needs a real web grid can override
 * `role` on the spread result — later JSX props win.
 *
 * Selection rides on `accessibilityState` *and* `aria-selected`, deliberately:
 * native reads only the first, react-native-web maps only the second. That is the
 * same dual emission the styled components use (see `FileSystem`'s list rows).
 *
 * `onKeyDown` is web-only. react-native-web forwards it; native never fires it,
 * so it is inert on a device rather than wrong.
 */

import type { ISODate } from './calendar';
import { type CalendarLocale, formatDayLabel } from './calendar-format';
import type { CalendarDayState } from './calendar-selection';
import { deriveTestID } from './calendar-test-id';

/** `'2026-08'` — the part of a month anchor that names it uniquely in a testID. */
function monthKey(month: ISODate): string {
  return month.slice(0, 7);
}

/**
 * A keyboard event, narrowed to the three things the grid reads.
 *
 * Structural rather than the DOM's `KeyboardEvent` so it accepts whichever shape
 * arrives: react-native-web hands over a React synthetic event, a consumer
 * wiring their own listener has a raw DOM one, and a test can pass
 * `{ key: 'ArrowRight', preventDefault() {} }` without constructing an event at
 * all. `shiftKey` is optional because only `PageUp`/`PageDown` consult it.
 */
export type WebKeyEvent = { key: string; shiftKey?: boolean; preventDefault: () => void };

/**
 * The one method the grid needs from a day's host node, so keyboard navigation can
 * move real focus rather than only a visual cursor. A DOM element and a `View`
 * both satisfy it; `focus` is optional because not every native host exposes it.
 */
export type FocusableNode = { focus?: () => void };

/** What a screen reader is told about a nav button. */
export type NavAccessibilityState = { disabled: boolean };

/** What a screen reader is told about a day cell. */
export type DayAccessibilityState = { disabled: boolean; selected: boolean };

/** One month on screen: its anchor, its heading, and its weeks. */
export type CalendarMonth = { month: ISODate; label: string; weeks: CalendarDayState[][] };

/** One column heading. `narrow` is not unique (English gives `T` twice), so `long` is the name. */
export type CalendarWeekday = { weekday: number; narrow: string; short: string; long: string };

/** Props for the element wrapping the whole calendar. */
export type CalendarRootProps = { testID: string | undefined; role: 'group'; 'aria-label': string };

/**
 * The outer container. `role`/`aria-label` name it on the web; native leaves the
 * naming to the month heading, since an `accessibilityLabel` on a plain container
 * would either be ignored or swallow the subtree.
 */
export function buildRootProps(testID: string | undefined, label: string): CalendarRootProps {
  return { testID, role: 'group', 'aria-label': label };
}

/** Props for the month heading. */
export type MonthLabelProps = { testID: string | undefined; accessibilityRole: 'header'; role: 'heading'; 'aria-live': 'polite' };

/**
 * The month heading. `aria-live` is what announces the change when a nav button
 * moves the calendar — the button's own name ("Next month") does not say where you
 * landed, and the days themselves are too many to announce.
 */
export function buildMonthLabelProps(testID: string | undefined, month: ISODate): MonthLabelProps {
  return {
    testID: deriveTestID(testID, `month-label-${monthKey(month)}`),
    accessibilityRole: 'header',
    role: 'heading',
    'aria-live': 'polite',
  };
}

/** Props for a per-month wrapper, the grid, and a week row — testID scoping only. */
export type CalendarSectionProps = { testID: string | undefined };

/** A month's wrapper in a multi-month layout, scoped so its testIDs stay unique. */
export function buildMonthProps(testID: string | undefined, month: ISODate): CalendarSectionProps {
  return { testID: deriveTestID(testID, `month-${monthKey(month)}`) };
}

/** The element holding the week rows. */
export function buildGridProps(testID: string | undefined, month: ISODate): CalendarSectionProps {
  return { testID: deriveTestID(testID, `grid-${monthKey(month)}`) };
}

/** One week row, indexed within its month. */
export function buildWeekProps(testID: string | undefined, month: ISODate, week: number): CalendarSectionProps {
  return { testID: deriveTestID(testID, `week-${monthKey(month)}-${week}`) };
}

/** Props for the weekday header row — hidden from assistive tech on all three platforms. */
export type WeekdayRowProps = {
  testID: string | undefined;
  accessibilityElementsHidden: true;
  importantForAccessibility: 'no-hide-descendants';
  'aria-hidden': true;
};

/**
 * The weekday header row, marked decorative.
 *
 * All three flags are needed because each platform reads a different one (iOS
 * `accessibilityElementsHidden`, Android `importantForAccessibility`, web
 * `aria-hidden`). Hiding it is deliberate: every day cell is already named with
 * its own weekday, so announcing the header as well makes a screen reader read
 * seven redundant names before reaching the first date.
 *
 * Pass `month` when each month renders its own row, so the testIDs stay unique.
 */
export function buildWeekdayRowProps(testID: string | undefined, month?: ISODate): WeekdayRowProps {
  const scope = month === undefined ? 'weekdays' : `weekdays-${monthKey(month)}`;
  return {
    testID: deriveTestID(testID, scope),
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants',
    'aria-hidden': true,
  };
}

/** One weekday heading, named by its absolute weekday (`0` Sunday … `6` Saturday). */
export function buildWeekdayProps(testID: string | undefined, weekday: number, month?: ISODate): CalendarSectionProps {
  const scope = month === undefined ? `weekday-${weekday}` : `weekday-${monthKey(month)}-${weekday}`;
  return { testID: deriveTestID(testID, scope) };
}

/** The callbacks a day cell routes back to the hook, each told which date it came from. */
export type DayHandlers = {
  onPress: (date: ISODate) => void;
  onFocus: (date: ISODate) => void;
  onHoverIn: (date: ISODate) => void;
  onHoverOut: () => void;
  onKeyDown: (event: WebKeyEvent) => void;
  /** Collects the host node so a keyboard step can move real focus, not just the cursor. */
  registerNode: (date: ISODate, node: FocusableNode | null) => void;
};

/** Props for one day cell. */
export type CalendarDayProps = {
  testID: string | undefined;
  accessibilityRole: 'button';
  role: 'button';
  accessibilityLabel: string;
  'aria-label': string;
  accessibilityState: DayAccessibilityState;
  'aria-selected': boolean;
  'aria-disabled': boolean;
  /** Roving tabindex: exactly one cell per calendar is reachable by Tab. */
  tabIndex: 0 | -1;
  ref: (node: FocusableNode | null) => void;
  onPress: () => void;
  onFocus: () => void;
  onHoverIn: () => void;
  onHoverOut: () => void;
  onKeyDown: (event: WebKeyEvent) => void;
};

/**
 * One day cell. `label` is the full spoken date, which the caller formats.
 *
 * A disabled day is reported through `aria-disabled` and `accessibilityState`
 * but is **not** given the `disabled` prop, so it still takes focus: a browser
 * skips a `disabled` button entirely, which would make a long blocked stretch
 * impossible to arrow across. The press is refused by the handler instead.
 */
export function buildDayProps(
  testID: string | undefined,
  day: CalendarDayState,
  label: string,
  handlers: DayHandlers,
): CalendarDayProps {
  const { date, isDisabled, isSelected, isFocused, outside } = day;
  return {
    testID: deriveTestID(testID, `day-${date}`),
    accessibilityRole: 'button',
    role: 'button',
    accessibilityLabel: label,
    'aria-label': label,
    accessibilityState: { disabled: isDisabled, selected: isSelected },
    'aria-selected': isSelected,
    'aria-disabled': isDisabled,
    tabIndex: isFocused ? 0 : -1,
    // An adjacent month's day is drawn twice when several months are on screen,
    // so only the in-month copy registers — otherwise one date would map to two
    // nodes and the cursor could land on whichever happened to attach last.
    // A block body, not an expression: React 19 treats a returned value as a
    // cleanup function, and `registerNode` returns `void` only by convention.
    ref: (node) => {
      if (!outside) handlers.registerNode(date, node);
    },
    onPress: () => handlers.onPress(date),
    onFocus: () => handlers.onFocus(date),
    onHoverIn: () => handlers.onHoverIn(date),
    onHoverOut: handlers.onHoverOut,
    onKeyDown: handlers.onKeyDown,
  };
}

/** Props for a month-stepping button. */
export type CalendarNavProps = {
  testID: string | undefined;
  accessibilityRole: 'button';
  role: 'button';
  accessibilityLabel: string;
  'aria-label': string;
  accessibilityState: NavAccessibilityState;
  'aria-disabled': boolean;
  disabled: boolean;
  onPress: () => void;
};

/** What {@link buildNavProps} needs, as one object so it stays inside the 4-param cap. */
export type NavPropsOptions = {
  testID: string | undefined;
  /** `'prev-month'` or `'next-month'` — also the testID suffix. */
  name: string;
  label: string;
  disabled: boolean;
  onPress: () => void;
};

/**
 * A month-stepping button. Unlike a day, this one *is* given `disabled`: there is
 * nothing to arrow across, and a dead button that still takes focus is a worse
 * outcome than one the browser skips.
 */
export function buildNavProps({ testID, name, label, disabled, onPress }: NavPropsOptions): CalendarNavProps {
  return {
    testID: deriveTestID(testID, name),
    accessibilityRole: 'button',
    role: 'button',
    accessibilityLabel: label,
    'aria-label': label,
    accessibilityState: { disabled },
    'aria-disabled': disabled,
    disabled,
    onPress,
  };
}

/**
 * The prop getters a calendar hook exposes. Declared here rather than beside the
 * hook so this module owns every prop shape in one place, and so the hook's own
 * return type is `<its state> & CalendarGetters`.
 *
 * Each takes the month (or day) it is for, so one calendar can render several
 * months without the getters needing to know which is which.
 */
export type CalendarGetters = {
  getRootProps: () => CalendarRootProps;
  getMonthProps: (month: ISODate) => CalendarSectionProps;
  getMonthLabelProps: (month: ISODate) => MonthLabelProps;
  getGridProps: (month: ISODate) => CalendarSectionProps;
  getWeekProps: (month: ISODate, week: number) => CalendarSectionProps;
  /** Pass `month` when each month renders its own weekday row. */
  getWeekdayRowProps: (month?: ISODate) => WeekdayRowProps;
  getWeekdayProps: (weekday: CalendarWeekday, month?: ISODate) => CalendarSectionProps;
  getDayProps: (day: CalendarDayState) => CalendarDayProps;
  getPreviousMonthProps: () => CalendarNavProps;
  getNextMonthProps: () => CalendarNavProps;
};

/** The two nav buttons' accessible names, already resolved from any overrides. */
export type NavLabels = { previous: string; next: string };

/** Everything {@link buildGetters} closes over, as one object. */
export type GetterContext = {
  testID: string | undefined;
  /** Forwarded to `Intl` when naming a day cell. */
  locale: CalendarLocale;
  rootLabel: string;
  navLabels: NavLabels;
  canGoToPreviousMonth: boolean;
  canGoToNextMonth: boolean;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  dayHandlers: DayHandlers;
};

/**
 * The ten getters, bound to one render's resolved state.
 *
 * Plain closures rather than a `useCallback` each: a day's props depend on that
 * day's own state, so the objects are rebuilt every render regardless and
 * memoising the factories would add bookkeeping that saves nothing.
 */
export function buildGetters(context: GetterContext): CalendarGetters {
  const { testID, locale, rootLabel, navLabels, dayHandlers } = context;
  return {
    getRootProps: () => buildRootProps(testID, rootLabel),
    getMonthProps: (month) => buildMonthProps(testID, month),
    getMonthLabelProps: (month) => buildMonthLabelProps(testID, month),
    getGridProps: (month) => buildGridProps(testID, month),
    getWeekProps: (month, week) => buildWeekProps(testID, month, week),
    getWeekdayRowProps: (month) => buildWeekdayRowProps(testID, month),
    getWeekdayProps: (weekday, month) => buildWeekdayProps(testID, weekday.weekday, month),
    getDayProps: (day) => buildDayProps(testID, day, formatDayLabel(day.date, locale), dayHandlers),
    getPreviousMonthProps: () =>
      buildNavProps({
        testID,
        name: 'prev-month',
        label: navLabels.previous,
        disabled: !context.canGoToPreviousMonth,
        onPress: context.goToPreviousMonth,
      }),
    getNextMonthProps: () =>
      buildNavProps({
        testID,
        name: 'next-month',
        label: navLabels.next,
        disabled: !context.canGoToNextMonth,
        onPress: context.goToNextMonth,
      }),
  };
}
