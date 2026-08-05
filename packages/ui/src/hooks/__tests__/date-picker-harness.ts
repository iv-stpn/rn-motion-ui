/**
 * Shared scaffolding for the `useDatePicker` suites.
 *
 * The picker's behaviour and its accessibility payload are two files' worth of
 * tests that drive it the same way, so the levers live here rather than twice.
 *
 * Not a `.test.ts`, so vitest treats it as a module rather than a suite.
 */
import { vi } from 'vitest';

import { type UseDatePickerOptions, type UseDatePickerReturn, useDatePicker } from '../use-date-picker';
import { type HookHarness, renderHook } from './render-hook';

// Declared ahead of the exports to satisfy `useExportsLast`. The type it is
// annotated with is declared below, which TypeScript hoists.
const mounted: Picker[] = [];

/** A Wednesday, so no step or bound lands on an edge by accident. */
export const TODAY = '2026-08-05';

/**
 * `today` and `locale` are pinned: the trigger's spoken name goes through `Intl`,
 * and the bounds cases would otherwise depend on the day the suite runs.
 */
export const BASE: UseDatePickerOptions = { today: TODAY, defaultMonth: '2026-08-01', locale: 'en-US' };

export type Picker = HookHarness<UseDatePickerOptions, UseDatePickerReturn>;

/** Mounts a picker over {@link BASE}. Pair with {@link unmountAll} in an `afterEach`. */
export function mountPicker(options: UseDatePickerOptions = {}): Picker {
  const view = renderHook(useDatePicker, { ...BASE, ...options });
  mounted.push(view);
  return view;
}

/** Tears down every picker mounted so far. */
export function unmountAll(): void {
  while (mounted.length > 0) mounted.pop()?.unmount();
}

/** Types into the field, as `onChangeText` arrives from a `TextInput`. */
export function type(view: Picker, text: string): void {
  view.act(() => view.current.getFieldProps().onChangeText(text));
}

/** Blurs the field. The getter is re-read so the handler closes over the live draft. */
export function blur(view: Picker): void {
  view.act(() => view.current.getFieldProps().onBlur());
}

/** Submits the field, which is the return key. */
export function submit(view: Picker): void {
  view.act(() => view.current.getFieldProps().onSubmitEditing());
}

/** Presses a day in the grid, which is what closes the panel by default. */
export function pressDay(view: Picker, date: string): void {
  const day = view.current.calendar.months
    .flatMap((month) => month.weeks.flat())
    .find((cell) => cell.date === date && !cell.outside);
  if (day === undefined) throw new Error(`no in-month cell for ${date}`);
  view.act(() => view.current.calendar.getDayProps(day).onPress());
}

/** Sends a key to the panel, handing back the `preventDefault` spy it was given. */
export function sendKey(view: Picker, key: string): ReturnType<typeof vi.fn> {
  const preventDefault = vi.fn();
  view.act(() => view.current.getPanelProps().onKeyDown({ key, preventDefault }));
  return preventDefault;
}
