/**
 * Shared scaffolding for the `useDateRangePicker` suites.
 *
 * Every field helper takes which end it is driving, so a case about the start and
 * the same case about the end read identically apart from that argument — which is
 * the point: the two fields are meant to be the same shape parameterised by one
 * value, and a test that proves it should look like it.
 *
 * Not a `.test.ts`, so vitest treats it as a module rather than a suite.
 */
import { vi } from 'vitest';

import type { RangeField } from '../../lib/date-field';
import type { DateFieldProps } from '../../lib/date-picker-props';
import { type UseDateRangePickerOptions, type UseDateRangePickerReturn, useDateRangePicker } from '../use-date-range-picker';
import { type HookHarness, renderHook } from './render-hook';

// Declared ahead of the exports to satisfy `useExportsLast`. The type it is
// annotated with is declared below, which TypeScript hoists.
const mounted: RangePicker[] = [];

/** A Wednesday, so no step or bound lands on an edge by accident. */
export const TODAY = '2026-08-05';

/**
 * `today` and `locale` are pinned: the trigger's spoken name goes through `Intl`,
 * and the bounds cases would otherwise depend on the day the suite runs.
 */
export const BASE: UseDateRangePickerOptions = { today: TODAY, defaultMonth: '2026-08-01', locale: 'en-US' };

export type RangePicker = HookHarness<UseDateRangePickerOptions, UseDateRangePickerReturn>;

/** Mounts a picker over {@link BASE}. Pair with {@link unmountAll} in an `afterEach`. */
export function mountRangePicker(options: UseDateRangePickerOptions = {}): RangePicker {
  const view = renderHook(useDateRangePicker, { ...BASE, ...options });
  mounted.push(view);
  return view;
}

/** Tears down every picker mounted so far. */
export function unmountAll(): void {
  while (mounted.length > 0) mounted.pop()?.unmount();
}

/**
 * One end's live field props.
 *
 * Re-read on every call rather than held in a variable, so each handler closes
 * over the current draft instead of the one that existed when the test started.
 */
export function field(view: RangePicker, which: RangeField): DateFieldProps {
  return which === 'start' ? view.current.getStartFieldProps() : view.current.getEndFieldProps();
}

/** Types into one field, as `onChangeText` arrives from a `TextInput`. */
export function type(view: RangePicker, which: RangeField, text: string): void {
  view.act(() => field(view, which).onChangeText(text));
}

/** Blurs one field, which commits without closing. */
export function blur(view: RangePicker, which: RangeField): void {
  view.act(() => field(view, which).onBlur());
}

/** Submits one field, which is the return key: commit and close. */
export function submit(view: RangePicker, which: RangeField): void {
  view.act(() => field(view, which).onSubmitEditing());
}

/** Presses a day in the grid. Two presses make a range; a third starts over. */
export function pressDay(view: RangePicker, date: string): void {
  const day = view.current.calendar.months
    .flatMap((month) => month.weeks.flat())
    .find((cell) => cell.date === date && !cell.outside);
  if (day === undefined) throw new Error(`no in-month cell for ${date}`);
  view.act(() => view.current.calendar.getDayProps(day).onPress());
}

/** The anchors of the months on screen, which the end field reveals differently. */
export function anchors(view: RangePicker): string[] {
  return view.current.calendar.months.map((month) => month.month);
}

/** Sends a key to the panel, handing back the `preventDefault` spy it was given. */
export function sendKey(view: RangePicker, key: string): ReturnType<typeof vi.fn> {
  const preventDefault = vi.fn();
  view.act(() => view.current.getPanelProps().onKeyDown({ key, preventDefault }));
  return preventDefault;
}
