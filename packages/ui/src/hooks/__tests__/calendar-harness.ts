/**
 * Shared scaffolding for the `useCalendar` suites.
 *
 * The hook splits cleanly into what it computes and where it puts the cursor,
 * which is two files' worth of tests. Both reach into the grid the same way, so
 * the accessors live here rather than being written twice.
 *
 * Not a `.test.ts`, so vitest treats it as a module rather than a suite.
 */
import type { FocusableNode } from '../../lib/calendar-props';
import type { CalendarDayState } from '../../lib/calendar-selection';
import { type UseCalendarOptions, type UseCalendarReturn, useCalendar } from '../use-calendar';
import { type HookHarness, renderHook } from './render-hook';

// Declared ahead of the exports to satisfy `useExportsLast`. The type it is
// annotated with is declared below, which TypeScript hoists.
const mounted: Calendar[] = [];

/** A Wednesday, mid-week and mid-month, so no step lands on an edge by accident. */
export const TODAY = '2026-08-05';

/**
 * `today` and `locale` are pinned: a floating today would make the bounds and
 * `goToToday` cases depend on the day the suite happens to run, and an unpinned
 * locale would make every `Intl` assertion machine-specific. `defaultMonth` is
 * pinned too, so a test about the anchor opts out with `defaultMonth: undefined`.
 */
export const BASE: UseCalendarOptions = { today: TODAY, defaultMonth: '2026-08-01', locale: 'en-US' };

export type Calendar = HookHarness<UseCalendarOptions, UseCalendarReturn>;

/** Mounts a calendar over {@link BASE}. Pair with {@link unmountAll} in an `afterEach`. */
export function mountCalendar(options: UseCalendarOptions = {}): Calendar {
  const view = renderHook(useCalendar, { ...BASE, ...options });
  mounted.push(view);
  return view;
}

/** Tears down every calendar mounted so far, so no stale root can steal focus. */
export function unmountAll(): void {
  while (mounted.length > 0) mounted.pop()?.unmount();
}

/** Every cell on screen, in visual order, adjacent-month padding included. */
export function cells(calendar: UseCalendarReturn): CalendarDayState[] {
  return calendar.months.flatMap((month) => month.weeks.flat());
}

/** The anchors of the months on screen. */
export function anchors(calendar: UseCalendarReturn): string[] {
  return calendar.months.map((month) => month.month);
}

/** The in-month cell for `date`. A padding copy is not the cell a user means. */
export function cell(calendar: UseCalendarReturn, date: string): CalendarDayState {
  const found = cells(calendar).find((day) => day.date === date && !day.outside);
  if (found === undefined) throw new Error(`no in-month cell for ${date} in ${anchors(calendar).join(', ')}`);
  return found;
}

/** The adjacent-month copy of `date` — a few assertions are specifically about it. */
export function padding(calendar: UseCalendarReturn, date: string): CalendarDayState {
  const found = cells(calendar).find((day) => day.date === date && day.outside);
  if (found === undefined) throw new Error(`no padding cell for ${date} in ${anchors(calendar).join(', ')}`);
  return found;
}

/** Presses a day, as a consumer spreading `getDayProps` onto a `Pressable` would. */
export function press(view: Calendar, date: string): void {
  view.act(() => view.current.getDayProps(cell(view.current, date)).onPress());
}

/** Sends a key to the cell the cursor is on, which is the only tabbable one. */
export function keydown(view: Calendar, key: string, shiftKey = false): void {
  const props = view.current.getDayProps(cell(view.current, view.current.focusedDate));
  view.act(() => props.onKeyDown({ key, shiftKey, preventDefault: () => undefined }));
}

/** Attaches (or detaches) a fake host node for a cell, as React does on mount. */
export function register(view: Calendar, date: string, node: FocusableNode | null): void {
  view.act(() => view.current.getDayProps(cell(view.current, date)).ref(node));
}
