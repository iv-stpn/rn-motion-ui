/**
 * Behaviour tests for `useDateRangePicker`: the two-step selection loop, the two
 * independent fields, and the closing rule that distinguishes it from the single
 * picker — a range closes when it is *complete*, not on the first press.
 *
 * The calendar's own range logic has its suites in `use-calendar-range.test.tsx`,
 * and the accessibility payload is in `use-date-range-picker-a11y.test.tsx`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  anchors,
  blur,
  mountRangePicker as mount,
  pressDay,
  sendKey,
  submit,
  type,
  unmountAll,
} from './date-range-picker-harness';

afterEach(unmountAll);

describe('the months on screen', () => {
  it('shows two months by default, and clamps a nonsense count to one', () => {
    // A range needs somewhere to end, so two is the useful default — unlike the
    // single picker, which shows one.
    expect(anchors(mount())).toEqual(['2026-08-01', '2026-09-01']);
    expect(anchors(mount({ numberOfMonths: 0 }))).toEqual(['2026-08-01']);
    expect(anchors(mount({ numberOfMonths: 3 }))).toEqual(['2026-08-01', '2026-09-01', '2026-10-01']);
  });
});

describe('the disclosure', () => {
  it('opens, closes and toggles', () => {
    const view = mount();
    expect(view.current.isOpen).toBe(false);
    view.act(() => view.current.open());
    expect(view.current.isOpen).toBe(true);
    view.act(() => view.current.close());
    expect(view.current.isOpen).toBe(false);
    view.act(() => view.current.toggle());
    expect(view.current.isOpen).toBe(true);
  });

  it('reports a controlled open state without changing itself', () => {
    const onOpenChange = vi.fn();
    const view = mount({ open: false, onOpenChange });
    view.act(() => view.current.open());
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(view.current.isOpen).toBe(false);
  });

  it('closes on Escape, and only while open', () => {
    const view = mount({ defaultOpen: true });
    expect(sendKey(view, 'Escape')).toHaveBeenCalledOnce();
    expect(view.current.isOpen).toBe(false);
    expect(sendKey(view, 'Escape')).not.toHaveBeenCalled();
    expect(sendKey(view, 'Enter')).not.toHaveBeenCalled();
  });

  it('closes from the backdrop, unless it is not dismissable', () => {
    const view = mount({ defaultOpen: true });
    view.act(() => view.current.getDismissProps().onPress());
    expect(view.current.isOpen).toBe(false);

    const fixed = mount({ defaultOpen: true, dismissable: false });
    expect(fixed.current.getDismissProps().disabled).toBe(true);
  });

  it('opens when either field takes focus, only when asked', () => {
    const view = mount();
    view.act(() => view.current.getStartFieldProps().onFocus());
    expect(view.current.isOpen).toBe(false);

    const eager = mount({ openOnFocus: true });
    eager.act(() => eager.current.getEndFieldProps().onFocus());
    expect(eager.current.isOpen).toBe(true);
  });
});

describe('picking from the grid', () => {
  it('takes two presses to complete, and closes only on the second', () => {
    const onSelectRange = vi.fn();
    const view = mount({ defaultOpen: true, onSelectRange });

    pressDay(view, '2026-08-10');
    // Half-open: the panel has to stay up for the second endpoint.
    expect(view.current.selectedRange).toEqual({ start: '2026-08-10', end: null });
    expect(view.current.isComplete).toBe(false);
    expect(view.current.isOpen).toBe(true);

    pressDay(view, '2026-08-20');
    expect(view.current.selectedRange).toEqual({ start: '2026-08-10', end: '2026-08-20' });
    expect(view.current.isComplete).toBe(true);
    expect(view.current.isOpen).toBe(false);
    expect(onSelectRange).toHaveBeenLastCalledWith({ start: '2026-08-10', end: '2026-08-20' });
  });

  it('normalises a range picked backwards', () => {
    const view = mount({ defaultOpen: true });
    pressDay(view, '2026-08-20');
    pressDay(view, '2026-08-10');
    // The earlier day becomes the start: the span is the same, and a reversed pair
    // would read as an impossible one.
    expect(view.current.selectedRange).toEqual({ start: '2026-08-10', end: '2026-08-20' });
  });

  it('starts a new range on the third press', () => {
    const view = mount({ defaultOpen: true, closeOnComplete: false });
    pressDay(view, '2026-08-10');
    pressDay(view, '2026-08-20');
    pressDay(view, '2026-08-25');
    expect(view.current.selectedRange).toEqual({ start: '2026-08-25', end: null });
    expect(view.current.isComplete).toBe(false);
  });

  it('stays open on completion when closeOnComplete is off', () => {
    const view = mount({ defaultOpen: true, closeOnComplete: false });
    pressDay(view, '2026-08-10');
    pressDay(view, '2026-08-20');
    expect(view.current.isComplete).toBe(true);
    expect(view.current.isOpen).toBe(true);
  });

  it('shows the picked ends in the two fields', () => {
    const view = mount();
    pressDay(view, '2026-08-10');
    expect([view.current.startValue, view.current.endValue]).toEqual(['2026-08-10', '']);
    pressDay(view, '2026-08-20');
    expect([view.current.startValue, view.current.endValue]).toEqual(['2026-08-10', '2026-08-20']);
  });
});

describe('the fields', () => {
  it('drafts each end independently, without committing either', () => {
    const onSelectRange = vi.fn();
    const view = mount({ onSelectRange });
    type(view, 'start', '2026-08-1');
    type(view, 'end', '2026-09-0');
    expect([view.current.startValue, view.current.endValue]).toEqual(['2026-08-1', '2026-09-0']);
    expect(view.current.selectedRange).toEqual({ start: null, end: null });
    expect(onSelectRange).not.toHaveBeenCalled();
  });

  it('commits one end on blur and leaves the other alone', () => {
    const view = mount({ defaultSelectedRange: { start: '2026-08-10', end: '2026-08-20' } });
    type(view, 'end', '2026-08-25');
    blur(view, 'end');
    expect(view.current.selectedRange).toEqual({ start: '2026-08-10', end: '2026-08-25' });
  });

  it('keeps the panel open on a blur-commit that completes the range', () => {
    const view = mount({ defaultOpen: true, defaultSelectedRange: { start: '2026-08-10', end: null } });
    type(view, 'end', '2026-08-20');
    blur(view, 'end');
    // Completing the range from a field does not close, even though completing it
    // from the grid does: a blur may be focus moving *into* the panel, and closing
    // there would swallow the press that caused it.
    expect(view.current.isComplete).toBe(true);
    expect(view.current.isOpen).toBe(true);
  });

  it('commits each end as focus leaves it, which is how both get typed', () => {
    const view = mount();
    type(view, 'start', '2026-08-10');
    // A real `TextInput` fires blur as focus moves to the next field, so the two
    // ends never hold drafts at the same time.
    blur(view, 'start');
    type(view, 'end', '2026-08-20');
    blur(view, 'end');
    expect(view.current.selectedRange).toEqual({ start: '2026-08-10', end: '2026-08-20' });
  });

  it('commits and closes on submit', () => {
    const view = mount({ defaultOpen: true });
    type(view, 'start', '2026-09-14');
    submit(view, 'start');
    expect(view.current.selectedRange).toEqual({ start: '2026-09-14', end: null });
    // The return key is a deliberate "done", even with the range half-open.
    expect(view.current.isOpen).toBe(false);
  });

  it('closes on submit from a field nobody edited, committing nothing', () => {
    const onSelectRange = vi.fn();
    const view = mount({ defaultOpen: true, defaultSelectedRange: { start: '2026-08-10', end: null }, onSelectRange });
    submit(view, 'end');
    expect(view.current.selectedRange).toEqual({ start: '2026-08-10', end: null });
    expect(onSelectRange).not.toHaveBeenCalled();
    expect(view.current.isOpen).toBe(false);
  });

  it('snaps back to the range when the text does not parse', () => {
    const view = mount({ defaultSelectedRange: { start: '2026-08-10', end: '2026-08-20' } });
    type(view, 'end', 'next tuesday');
    blur(view, 'end');
    // The end the user never asked to remove survives, and the field shows it again.
    expect(view.current.selectedRange).toEqual({ start: '2026-08-10', end: '2026-08-20' });
    expect(view.current.endValue).toBe('2026-08-20');
  });

  it('refuses a real date the bounds disallow', () => {
    const view = mount({ maxDate: '2026-08-31', defaultSelectedRange: { start: '2026-08-10', end: '2026-08-20' } });
    type(view, 'end', '2026-09-14');
    blur(view, 'end');
    expect(view.current.selectedRange).toEqual({ start: '2026-08-10', end: '2026-08-20' });
  });

  it('empties only the end it was cleared from', () => {
    const view = mount({ defaultSelectedRange: { start: '2026-08-10', end: '2026-08-20' } });
    type(view, 'start', '');
    blur(view, 'start');
    // A half-open range is left behind, which the next press can complete.
    expect(view.current.selectedRange).toEqual({ start: null, end: '2026-08-20' });
    expect(view.current.endValue).toBe('2026-08-20');
  });

  it('reorders when an end is typed before the start', () => {
    const view = mount({ defaultSelectedRange: { start: '2026-08-20', end: null } });
    type(view, 'end', '2026-08-10');
    blur(view, 'end');
    // The same forgiveness the grid's second press gets, rather than a rejection.
    expect(view.current.selectedRange).toEqual({ start: '2026-08-10', end: '2026-08-20' });
  });

  it('completes a half-open range from the other field', () => {
    const view = mount({ defaultSelectedRange: { start: null, end: '2026-08-20' } });
    type(view, 'start', '2026-08-10');
    blur(view, 'start');
    expect(view.current.isComplete).toBe(true);
  });

  it('follows a complete typed date with the grid, and ignores a partial one', () => {
    const view = mount();
    type(view, 'start', '2026-11-0');
    expect(anchors(view)).toEqual(['2026-08-01', '2026-09-01']);
    type(view, 'start', '2026-11-03');
    expect(anchors(view)).toEqual(['2026-11-01', '2026-12-01']);
  });

  it('puts an end-field date in the last month shown, not the first', () => {
    const view = mount();
    type(view, 'end', '2026-11-03');
    // Aiming the end at the last pane keeps the start visible beside it instead of
    // paging past it.
    expect(anchors(view)).toEqual(['2026-10-01', '2026-11-01']);
  });

  it('still shows the day that was typed after a reorder', () => {
    const view = mount({ defaultSelectedRange: { start: '2026-12-10', end: null } });
    type(view, 'end', '2026-09-14');
    blur(view, 'end');
    expect(view.current.selectedRange).toEqual({ start: '2026-09-14', end: '2026-12-10' });
    // Committed as the *start*, but revealed as the end field asked: the user should
    // see the day they just typed.
    expect(anchors(view)).toEqual(['2026-08-01', '2026-09-01']);
  });
});

describe('clearing', () => {
  it('empties the range, both fields, and disables itself when there is nothing left', () => {
    const view = mount({ defaultSelectedRange: { start: '2026-08-10', end: '2026-08-20' } });
    expect(view.current.getClearProps().disabled).toBe(false);
    view.act(() => view.current.getClearProps().onPress());
    expect(view.current.selectedRange).toEqual({ start: null, end: null });
    expect([view.current.startValue, view.current.endValue]).toEqual(['', '']);
    expect(view.current.getClearProps().disabled).toBe(true);
  });

  it('is enabled by a half-open range, which is still something to clear', () => {
    const view = mount({ defaultSelectedRange: { start: '2026-08-10', end: null } });
    expect(view.current.getClearProps().disabled).toBe(false);
  });

  it('drops a draft along with the range', () => {
    const view = mount({ defaultSelectedRange: { start: '2026-08-10', end: '2026-08-20' } });
    type(view, 'end', '2026-08-2');
    view.act(() => view.current.getClearProps().onPress());
    expect(view.current.endValue).toBe('');
  });
});
