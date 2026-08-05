/**
 * State tests for `useCalendar`: the anchor, the controlled/uncontrolled seams,
 * the two selection loops, and the bounds reaching the nav buttons.
 *
 * The pure parts are covered directly already (`calendar`, `calendar-format`,
 * `calendar-selection`), so nothing here re-tests date arithmetic — only what
 * needs a mounted hook. The focus cursor and the resolved prop getters are in
 * `use-calendar-keyboard.test.tsx`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { anchors, cell, cells, mountCalendar, padding, press, TODAY, unmountAll } from './calendar-harness';

afterEach(unmountAll);

describe('the months on screen', () => {
  it('shows one month, anchored to the 1st', () => {
    const view = mountCalendar();
    expect(anchors(view.current)).toEqual(['2026-08-01']);
    expect(view.current.month).toBe('2026-08-01');
    expect(view.current.months[0]?.label).toBe('August 2026');
    expect(cell(view.current, TODAY).isToday).toBe(true);
  });

  it('falls back to the month holding today', () => {
    const view = mountCalendar({ defaultMonth: undefined });
    expect(view.current.month).toBe('2026-08-01');
  });

  it('anchors on the selection when no default month is given', () => {
    const view = mountCalendar({ defaultMonth: undefined, defaultSelectedDate: '2026-11-20' });
    expect(view.current.month).toBe('2026-11-01');
  });

  it('anchors on a default range start in range mode', () => {
    const range = { start: '2027-02-10', end: '2027-02-14' };
    const view = mountCalendar({ mode: 'range', defaultMonth: undefined, defaultSelectedRange: range });
    expect(view.current.month).toBe('2027-02-01');
  });

  it('lets an explicit default month win over the selection', () => {
    const view = mountCalendar({ defaultMonth: '2026-03-01', defaultSelectedDate: '2026-11-20' });
    expect(view.current.month).toBe('2026-03-01');
  });

  it('shows several months at once', () => {
    const view = mountCalendar({ numberOfMonths: 3 });
    expect(anchors(view.current)).toEqual(['2026-08-01', '2026-09-01', '2026-10-01']);
  });

  it('treats a count below one as one month', () => {
    const view = mountCalendar({ numberOfMonths: 0 });
    expect(anchors(view.current)).toEqual(['2026-08-01']);
  });
});

describe('stepping between months', () => {
  it('steps forward and back by one month', () => {
    const view = mountCalendar();
    view.act(() => view.current.goToNextMonth());
    expect(view.current.month).toBe('2026-09-01');
    view.act(() => view.current.goToPreviousMonth());
    expect(view.current.month).toBe('2026-08-01');
  });

  it('steps by one month even when several are shown', () => {
    const view = mountCalendar({ numberOfMonths: 2 });
    view.act(() => view.current.goToNextMonth());
    // Paging by two would carry away both months the user was comparing.
    expect(anchors(view.current)).toEqual(['2026-09-01', '2026-10-01']);
  });

  it('anchors a mid-month jump to the 1st', () => {
    const view = mountCalendar();
    view.act(() => view.current.goToMonth('2026-12-25'));
    expect(view.current.month).toBe('2026-12-01');
  });

  it('reports a controlled month without moving itself', () => {
    const onMonthChange = vi.fn();
    const view = mountCalendar({ month: '2026-08-01', onMonthChange });
    view.act(() => view.current.goToNextMonth());
    expect(onMonthChange).toHaveBeenCalledWith('2026-09-01');
    expect(view.current.month).toBe('2026-08-01');

    view.rerender({ today: TODAY, locale: 'en-US', month: '2026-09-01', onMonthChange });
    expect(view.current.month).toBe('2026-09-01');
  });
});

describe('single selection', () => {
  it('selects a pressed day and reports it', () => {
    const onSelectDate = vi.fn();
    const view = mountCalendar({ onSelectDate });
    press(view, '2026-08-12');
    expect(view.current.selectedDate).toBe('2026-08-12');
    expect(onSelectDate).toHaveBeenCalledWith('2026-08-12');
  });

  it('marks the selected day, and only it', () => {
    const view = mountCalendar();
    press(view, '2026-08-12');
    const selected = cells(view.current).filter((day) => day.isSelected);
    expect(selected.map((day) => day.date)).toEqual(['2026-08-12']);
  });

  it('keeps the selection on a re-press by default', () => {
    const view = mountCalendar();
    press(view, '2026-08-12');
    press(view, '2026-08-12');
    expect(view.current.selectedDate).toBe('2026-08-12');
  });

  it('clears on a re-press when deselectable', () => {
    const onSelectDate = vi.fn();
    const view = mountCalendar({ deselectable: true, onSelectDate });
    press(view, '2026-08-12');
    press(view, '2026-08-12');
    expect(view.current.selectedDate).toBeNull();
    expect(onSelectDate).toHaveBeenLastCalledWith(null);
  });

  it('reports a controlled selection without changing itself', () => {
    const onSelectDate = vi.fn();
    const view = mountCalendar({ selectedDate: '2026-08-01', onSelectDate });
    press(view, '2026-08-12');
    expect(onSelectDate).toHaveBeenCalledWith('2026-08-12');
    expect(view.current.selectedDate).toBe('2026-08-01');
  });

  it('clears the selection outright', () => {
    const view = mountCalendar({ defaultSelectedDate: '2026-08-12' });
    view.act(() => view.current.clearSelection());
    expect(view.current.selectedDate).toBeNull();
  });

  it('leaves the range shape empty in single mode', () => {
    const view = mountCalendar({ defaultSelectedDate: '2026-08-12' });
    expect(view.current.selectedRange).toEqual({ start: null, end: null });
  });

  it('pulls the view along when an adjacent month cell is pressed', () => {
    const view = mountCalendar();
    // August 2026 ends on a Monday, so its last row is padded with September.
    view.act(() => view.current.getDayProps(padding(view.current, '2026-09-01')).onPress());
    expect(view.current.selectedDate).toBe('2026-09-01');
    expect(view.current.month).toBe('2026-09-01');
  });
});

describe('refusing a blocked day', () => {
  it('refuses a day before minDate', () => {
    const onSelectDate = vi.fn();
    const view = mountCalendar({ minDate: '2026-08-10', onSelectDate });
    press(view, '2026-08-04');
    expect(view.current.selectedDate).toBeNull();
    expect(onSelectDate).not.toHaveBeenCalled();
  });

  it('refuses a day after maxDate', () => {
    const view = mountCalendar({ maxDate: '2026-08-10' });
    press(view, '2026-08-20');
    expect(view.current.selectedDate).toBeNull();
  });

  it("refuses a day the consumer's predicate blocks", () => {
    const view = mountCalendar({ isDateDisabled: (date) => date === '2026-08-12' });
    press(view, '2026-08-12');
    expect(view.current.selectedDate).toBeNull();
    press(view, '2026-08-13');
    expect(view.current.selectedDate).toBe('2026-08-13');
  });

  it('refuses a blocked day passed to selectDate directly', () => {
    const view = mountCalendar({ minDate: '2026-08-10' });
    // Checked in the hook, not only in the press handler, so a programmatic call
    // cannot put an out-of-bounds day into the selection either.
    view.act(() => view.current.selectDate('2026-08-04'));
    expect(view.current.selectedDate).toBeNull();
  });

  it('still moves the cursor onto a refused day', () => {
    const view = mountCalendar({ minDate: '2026-08-10' });
    press(view, '2026-08-04');
    // Standing on a day you cannot pick is legitimate: the keyboard has to be
    // able to cross a blocked stretch to reach what is past it.
    expect(view.current.focusedDate).toBe('2026-08-04');
  });
});

describe('bounds and the nav buttons', () => {
  it('can step both ways with no bounds', () => {
    const view = mountCalendar();
    expect([view.current.canGoToPreviousMonth, view.current.canGoToNextMonth]).toEqual([true, true]);
    expect(view.current.getPreviousMonthProps().disabled).toBe(false);
  });

  it('disables stepping back when no earlier day is reachable', () => {
    const view = mountCalendar({ minDate: '2026-08-01' });
    expect(view.current.canGoToPreviousMonth).toBe(false);
    expect(view.current.getPreviousMonthProps().disabled).toBe(true);
  });

  it('keeps stepping back while the previous month still holds a selectable day', () => {
    const view = mountCalendar({ minDate: '2026-07-15' });
    // The whole revealed month is the test, not its 1st — disabling here would
    // strand the second half of July.
    expect(view.current.canGoToPreviousMonth).toBe(true);
  });

  it('disables stepping forward past maxDate', () => {
    const view = mountCalendar({ maxDate: '2026-08-31' });
    expect(view.current.canGoToNextMonth).toBe(false);
    expect(view.current.getNextMonthProps().disabled).toBe(true);
  });

  it('measures the forward bound from the last month on screen', () => {
    const view = mountCalendar({ numberOfMonths: 2, maxDate: '2026-09-30' });
    // Two months are shown, so September is already visible and stepping would
    // reveal October — past the bound.
    expect(view.current.canGoToNextMonth).toBe(false);
  });

  it('marks blocked days disabled without disabling their cell', () => {
    const view = mountCalendar({ minDate: '2026-08-10' });
    const blocked = view.current.getDayProps(cell(view.current, '2026-08-04'));
    expect([blocked['aria-disabled'], blocked.accessibilityState.disabled]).toEqual([true, true]);
    // No `disabled` prop: a browser skips a disabled button, which would make a
    // long blocked stretch impossible to arrow across.
    expect(Object.hasOwn(blocked, 'disabled')).toBe(false);
  });
});
