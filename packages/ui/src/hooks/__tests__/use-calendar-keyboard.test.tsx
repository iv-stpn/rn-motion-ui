/**
 * Keyboard, focus and prop-getter tests for `useCalendar`.
 *
 * The three belong together because they are one mechanism seen from three sides:
 * a key moves the cursor, the cursor moves real focus through a cell's `ref`, and
 * `tabIndex` is how a consumer can tell where the cursor is. The pure key→date
 * arithmetic is already covered in `calendar-selection.test.ts`, so what is left
 * here is the wiring.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { anchors, cell, cells, keydown, mountCalendar, padding, press, register, TODAY, unmountAll } from './calendar-harness';

afterEach(unmountAll);

describe('moving the cursor with the keyboard', () => {
  it('starts on the anchor day', () => {
    const view = mountCalendar();
    expect(view.current.focusedDate).toBe('2026-08-01');
  });

  it('steps a day sideways and a week vertically', () => {
    const view = mountCalendar({ defaultSelectedDate: TODAY });
    press(view, TODAY);
    keydown(view, 'ArrowRight');
    expect(view.current.focusedDate).toBe('2026-08-06');
    keydown(view, 'ArrowDown');
    expect(view.current.focusedDate).toBe('2026-08-13');
    keydown(view, 'ArrowUp');
    expect(view.current.focusedDate).toBe('2026-08-06');
    keydown(view, 'ArrowLeft');
    expect(view.current.focusedDate).toBe('2026-08-05');
  });

  it("snaps to the row's own ends, not the month's", () => {
    const view = mountCalendar();
    press(view, TODAY);
    keydown(view, 'Home');
    // Wednesday the 5th sits in the row beginning Sunday the 2nd.
    expect(view.current.focusedDate).toBe('2026-08-02');
    keydown(view, 'End');
    expect(view.current.focusedDate).toBe('2026-08-08');
  });

  it('honours weekStartsOn when snapping to a row end', () => {
    const view = mountCalendar({ weekStartsOn: 1 });
    press(view, TODAY);
    keydown(view, 'Home');
    expect(view.current.focusedDate).toBe('2026-08-03');
  });

  it('pages by month, and by year with shift', () => {
    const view = mountCalendar();
    press(view, TODAY);
    keydown(view, 'PageDown');
    expect(view.current.focusedDate).toBe('2026-09-05');
    keydown(view, 'PageUp');
    expect(view.current.focusedDate).toBe('2026-08-05');
    keydown(view, 'PageDown', true);
    expect(view.current.focusedDate).toBe('2027-08-05');
  });

  it('mirrors the horizontal axis under RTL', () => {
    const view = mountCalendar({ isRTL: true });
    press(view, TODAY);
    keydown(view, 'ArrowRight');
    expect(view.current.focusedDate).toBe('2026-08-04');
    keydown(view, 'ArrowDown');
    // Only the horizontal axis mirrors: a week still runs top to bottom.
    expect(view.current.focusedDate).toBe('2026-08-11');
  });

  it('clamps the cursor to the bounds', () => {
    const view = mountCalendar({ minDate: '2026-08-04' });
    press(view, '2026-08-04');
    keydown(view, 'ArrowLeft');
    expect(view.current.focusedDate).toBe('2026-08-04');
  });

  it('pulls the view along when a step leaves the month', () => {
    const view = mountCalendar();
    press(view, '2026-08-31');
    keydown(view, 'ArrowRight');
    expect(view.current.focusedDate).toBe('2026-09-01');
    expect(view.current.month).toBe('2026-09-01');
  });

  it('leaves the view alone while the step stays on screen', () => {
    const view = mountCalendar({ numberOfMonths: 2 });
    press(view, '2026-08-31');
    keydown(view, 'ArrowRight');
    // September is already visible, so there is nothing to page.
    expect(anchors(view.current)).toEqual(['2026-08-01', '2026-09-01']);
  });

  it('ignores a key the grid does not handle', () => {
    const view = mountCalendar();
    const preventDefault = vi.fn();
    press(view, TODAY);
    const props = view.current.getDayProps(cell(view.current, TODAY));
    view.act(() => props.onKeyDown({ key: 'Tab', preventDefault }));
    // Unhandled keys keep their default, so Tab can still leave the grid.
    expect(preventDefault).not.toHaveBeenCalled();
    expect(view.current.focusedDate).toBe(TODAY);
  });

  it('swallows the default only for a key it acts on', () => {
    const view = mountCalendar();
    const preventDefault = vi.fn();
    const props = view.current.getDayProps(cell(view.current, '2026-08-01'));
    view.act(() => props.onKeyDown({ key: 'ArrowRight', preventDefault }));
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it('lets a platform focus event move the cursor without paging', () => {
    const view = mountCalendar();
    view.act(() => view.current.getDayProps(cell(view.current, '2026-08-20')).onFocus());
    expect(view.current.focusedDate).toBe('2026-08-20');
    expect(view.current.month).toBe('2026-08-01');
  });

  it('lands on today, clamped into the bounds', () => {
    const view = mountCalendar({ defaultMonth: '2026-12-01' });
    view.act(() => view.current.goToToday());
    expect(view.current.focusedDate).toBe(TODAY);
    expect(view.current.month).toBe('2026-08-01');

    const bounded = mountCalendar({ defaultMonth: '2026-12-01', minDate: '2026-09-10' });
    bounded.act(() => bounded.current.goToToday());
    expect(bounded.current.focusedDate).toBe('2026-09-10');
  });
});

describe('the roving tab stop', () => {
  it('leaves exactly one cell tabbable', () => {
    const view = mountCalendar({ numberOfMonths: 2 });
    const tabbable = cells(view.current).filter((day) => view.current.getDayProps(day).tabIndex === 0);
    expect(tabbable.map((day) => day.date)).toEqual(['2026-08-01']);
  });

  it('moves the tab stop with the cursor', () => {
    const view = mountCalendar();
    press(view, TODAY);
    expect(view.current.getDayProps(cell(view.current, TODAY)).tabIndex).toBe(0);
    expect(view.current.getDayProps(cell(view.current, '2026-08-01')).tabIndex).toBe(-1);
  });

  it('never puts the tab stop on an adjacent-month copy', () => {
    const view = mountCalendar({ numberOfMonths: 2 });
    press(view, '2026-09-01');
    // The 1st of September is drawn twice — as August's padding and as its own
    // month's cell. Two cells at `tabIndex={0}` would be two stops for one date.
    expect(view.current.getDayProps(padding(view.current, '2026-09-01')).tabIndex).toBe(-1);
    expect(view.current.getDayProps(cell(view.current, '2026-09-01')).tabIndex).toBe(0);
  });

  it('keeps a cell tabbable when the cursor falls outside the view', () => {
    const view = mountCalendar();
    press(view, TODAY);
    // Stepping the months moves the window but not the stored cursor, so the
    // cursor is clamped to the nearest edge day rather than vanishing.
    view.act(() => view.current.goToMonth('2026-12-01'));
    expect(view.current.focusedDate).toBe('2026-12-01');
    expect(view.current.getDayProps(cell(view.current, '2026-12-01')).tabIndex).toBe(0);
  });
});

describe('following the cursor with real focus', () => {
  it('focuses the cell the cursor moves onto', () => {
    const view = mountCalendar();
    const focus = vi.fn();
    press(view, TODAY);
    register(view, '2026-08-06', { focus });
    keydown(view, 'ArrowRight');
    expect(focus).toHaveBeenCalledOnce();
  });

  it('focuses a cell that only mounts after the step', () => {
    const view = mountCalendar();
    const focus = vi.fn();
    press(view, '2026-08-31');
    // Stepping off the end of August mounts September, so the destination does not
    // exist yet at the moment the cursor asks for it.
    keydown(view, 'ArrowRight');
    expect(focus).not.toHaveBeenCalled();
    register(view, '2026-09-01', { focus });
    expect(focus).toHaveBeenCalledOnce();
  });

  it('ignores an adjacent-month copy when resolving the pending cell', () => {
    const view = mountCalendar({ numberOfMonths: 2 });
    const outside = vi.fn();
    const inside = vi.fn();
    press(view, '2026-08-31');
    view.act(() => view.current.getDayProps(padding(view.current, '2026-09-01')).ref({ focus: outside }));
    keydown(view, 'ArrowRight');
    // Only the in-month copy registers, so one date maps to one node.
    expect(outside).not.toHaveBeenCalled();
    register(view, '2026-09-01', { focus: inside });
    expect(inside).toHaveBeenCalledOnce();
  });

  it('forgets a cell that unmounts', () => {
    const view = mountCalendar();
    const focus = vi.fn();
    press(view, TODAY);
    register(view, '2026-08-06', { focus });
    register(view, '2026-08-06', null);
    keydown(view, 'ArrowRight');
    expect(focus).not.toHaveBeenCalled();
  });
});

describe('the resolved prop getters', () => {
  it('names the calendar by the months on screen', () => {
    const view = mountCalendar();
    expect(view.current.getRootProps()).toEqual({ testID: undefined, role: 'group', 'aria-label': 'August 2026' });

    const two = mountCalendar({ numberOfMonths: 2 });
    expect(two.current.getRootProps()['aria-label']).toBe('August 2026 – September 2026');
  });

  it('lets a label override the derived name', () => {
    const view = mountCalendar({ labels: { calendar: 'Departure', previousMonth: 'Back', nextMonth: 'Forward' } });
    expect(view.current.getRootProps()['aria-label']).toBe('Departure');
    expect(view.current.getPreviousMonthProps()['aria-label']).toBe('Back');
    expect(view.current.getNextMonthProps()['aria-label']).toBe('Forward');
  });

  it('names a day cell with its full spoken date', () => {
    const view = mountCalendar();
    const day = view.current.getDayProps(cell(view.current, TODAY));
    // Not the bare number: "5" tells a screen reader user nothing about where in
    // the grid they have landed.
    expect(day.accessibilityLabel).toBe('Wednesday, August 5, 2026');
    expect(day['aria-label']).toBe(day.accessibilityLabel);
  });

  it('reports selection in both the native and the web form', () => {
    const view = mountCalendar();
    press(view, TODAY);
    const day = view.current.getDayProps(cell(view.current, TODAY));
    // Native reads `accessibilityState`, react-native-web maps only `aria-*`.
    expect(day.accessibilityState).toEqual({ disabled: false, selected: true });
    expect(day['aria-selected']).toBe(true);
  });

  it('announces the month heading politely', () => {
    const view = mountCalendar();
    const label = view.current.getMonthLabelProps('2026-08-01');
    // The nav button's own name does not say where you landed, and the days are
    // too many to announce.
    expect(label).toMatchObject({ accessibilityRole: 'header', role: 'heading', 'aria-live': 'polite' });
  });

  it('hides the weekday header from all three platforms', () => {
    const view = mountCalendar();
    expect(view.current.getWeekdayRowProps()).toMatchObject({
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
      'aria-hidden': true,
    });
  });

  it('derives every testID from the root, or none at all', () => {
    const view = mountCalendar({ testID: 'trip' });
    expect(view.current.getRootProps().testID).toBe('trip');
    expect(view.current.getDayProps(cell(view.current, TODAY)).testID).toBe('trip-day-2026-08-05');
    expect(view.current.getMonthLabelProps('2026-08-01').testID).toBe('trip-month-label-2026-08');
    expect(view.current.getGridProps('2026-08-01').testID).toBe('trip-grid-2026-08');
    expect(view.current.getWeekProps('2026-08-01', 2).testID).toBe('trip-week-2026-08-2');
    expect(view.current.getPreviousMonthProps().testID).toBe('trip-prev-month');
    expect(view.current.getNextMonthProps().testID).toBe('trip-next-month');

    const anonymous = mountCalendar();
    // No default root: two grids on one screen must not answer to the same query.
    expect(anonymous.current.getDayProps(cell(anonymous.current, TODAY)).testID).toBeUndefined();
  });

  it('scopes a weekday heading by month when each month renders its own row', () => {
    const view = mountCalendar({ testID: 'trip', numberOfMonths: 2 });
    const monday = view.current.weekdays[1];
    if (monday === undefined) throw new Error('expected seven weekdays');
    expect(view.current.getWeekdayProps(monday).testID).toBe('trip-weekday-1');
    expect(view.current.getWeekdayProps(monday, '2026-09-01').testID).toBe('trip-weekday-2026-09-1');
  });

  it('offers all three weekday widths, keyed by absolute weekday', () => {
    const view = mountCalendar({ weekStartsOn: 1 });
    expect(view.current.weekdays.map((day) => day.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(view.current.weekdays[0]).toEqual({ weekday: 1, narrow: 'M', short: 'Mon', long: 'Monday' });
  });

  it('steps the months from the nav props themselves', () => {
    const view = mountCalendar();
    view.act(() => view.current.getNextMonthProps().onPress());
    expect(view.current.month).toBe('2026-09-01');
    view.act(() => view.current.getPreviousMonthProps().onPress());
    expect(view.current.month).toBe('2026-08-01');
  });
});
