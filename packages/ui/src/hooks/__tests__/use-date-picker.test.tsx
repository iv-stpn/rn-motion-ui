/**
 * Behaviour tests for `useDatePicker`: the disclosure, the typeable field, and the
 * interaction between them — which is where the subtle cases live (a blur that
 * must not close the panel, a field nobody edited that must commit nothing).
 *
 * The calendar underneath has its own suites, and the accessibility payload is in
 * `use-date-picker-a11y.test.tsx`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DateFieldFormat } from '../../lib/date-field';
import { blur, mountPicker as mount, pressDay, sendKey, submit, type, unmountAll } from './date-picker-harness';

/** Hoisted rather than built per parse: the rule against a regex in a hot function. */
const US_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

afterEach(unmountAll);

describe('the disclosure', () => {
  it('starts closed and opens, closes and toggles', () => {
    const view = mount();
    expect(view.current.isOpen).toBe(false);
    view.act(() => view.current.open());
    expect(view.current.isOpen).toBe(true);
    view.act(() => view.current.close());
    expect(view.current.isOpen).toBe(false);
    view.act(() => view.current.toggle());
    expect(view.current.isOpen).toBe(true);
  });

  it('honours defaultOpen', () => {
    const view = mount({ defaultOpen: true });
    expect(view.current.isOpen).toBe(true);
  });

  it('reports a controlled open state without changing itself', () => {
    const onOpenChange = vi.fn();
    const view = mount({ open: false, onOpenChange });
    view.act(() => view.current.open());
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(view.current.isOpen).toBe(false);
  });

  it('opens from the trigger, reporting the state in both a11y forms', () => {
    const view = mount();
    expect(view.current.getTriggerProps()['aria-expanded']).toBe(false);
    view.act(() => view.current.getTriggerProps().onPress());
    const trigger = view.current.getTriggerProps();
    expect(trigger['aria-expanded']).toBe(true);
    expect(trigger.accessibilityState).toEqual({ disabled: false, expanded: true });
  });

  it('closes on Escape, and only while open', () => {
    const view = mount({ defaultOpen: true });
    expect(sendKey(view, 'Escape')).toHaveBeenCalledOnce();
    expect(view.current.isOpen).toBe(false);
    // Already closed: nothing to swallow, so the key keeps its default.
    expect(sendKey(view, 'Escape')).not.toHaveBeenCalled();
    expect(sendKey(view, 'Enter')).not.toHaveBeenCalled();
  });

  it('closes from the backdrop, unless it is not dismissable', () => {
    const view = mount({ defaultOpen: true });
    expect(view.current.getDismissProps().disabled).toBe(false);
    view.act(() => view.current.getDismissProps().onPress());
    expect(view.current.isOpen).toBe(false);

    const fixed = mount({ defaultOpen: true, dismissable: false });
    expect(fixed.current.getDismissProps().disabled).toBe(true);
  });

  it('opens on focus only when asked', () => {
    const view = mount();
    view.act(() => view.current.getFieldProps().onFocus());
    expect(view.current.isOpen).toBe(false);

    const eager = mount({ openOnFocus: true });
    eager.act(() => eager.current.getFieldProps().onFocus());
    expect(eager.current.isOpen).toBe(true);
  });
});

describe('picking from the grid', () => {
  it('selects the day and closes', () => {
    const onSelectDate = vi.fn();
    const view = mount({ defaultOpen: true, onSelectDate });
    pressDay(view, '2026-08-12');
    expect(view.current.selectedDate).toBe('2026-08-12');
    expect(onSelectDate).toHaveBeenCalledWith('2026-08-12');
    expect(view.current.isOpen).toBe(false);
  });

  it('stays open when closeOnSelect is off', () => {
    const view = mount({ defaultOpen: true, closeOnSelect: false });
    pressDay(view, '2026-08-12');
    expect(view.current.isOpen).toBe(true);
  });

  it('stays open when a deselection empties the value', () => {
    const view = mount({ defaultOpen: true, deselectable: true, defaultSelectedDate: '2026-08-12' });
    pressDay(view, '2026-08-12');
    // Closing on `null` would dismiss the panel on the press that cleared it,
    // leaving no way to pick again without reopening.
    expect(view.current.selectedDate).toBeNull();
    expect(view.current.isOpen).toBe(true);
  });

  it('shows the selection in the field', () => {
    const view = mount();
    pressDay(view, '2026-08-12');
    expect(view.current.inputValue).toBe('2026-08-12');
  });
});

describe('the field', () => {
  it('is empty with no selection, and formatted with one', () => {
    const view = mount();
    expect(view.current.inputValue).toBe('');

    const filled = mount({ defaultSelectedDate: '2026-08-12' });
    expect(filled.current.inputValue).toBe('2026-08-12');
  });

  it('shows the draft while typing, without committing it', () => {
    const onSelectDate = vi.fn();
    const view = mount({ onSelectDate });
    type(view, '2026-08-1');
    expect(view.current.inputValue).toBe('2026-08-1');
    expect(view.current.selectedDate).toBeNull();
    expect(onSelectDate).not.toHaveBeenCalled();
  });

  it('commits a typed date on blur', () => {
    const onSelectDate = vi.fn();
    const view = mount({ onSelectDate });
    type(view, '2026-09-14');
    blur(view);
    expect(view.current.selectedDate).toBe('2026-09-14');
    expect(onSelectDate).toHaveBeenCalledWith('2026-09-14');
  });

  it('keeps the panel open when a blur commits', () => {
    const view = mount({ defaultOpen: true });
    type(view, '2026-09-14');
    blur(view);
    // The blur may be focus moving *into* the panel; closing would swallow the
    // press that caused it.
    expect(view.current.isOpen).toBe(true);
  });

  it('commits and closes on submit', () => {
    const view = mount({ defaultOpen: true });
    type(view, '2026-09-14');
    submit(view);
    expect(view.current.selectedDate).toBe('2026-09-14');
    expect(view.current.isOpen).toBe(false);
  });

  it('snaps back to the selection when the text does not parse', () => {
    const onSelectDate = vi.fn();
    const view = mount({ defaultSelectedDate: '2026-08-12', onSelectDate });
    type(view, 'next tuesday');
    blur(view);
    // Rejected, not cleared: the user never asked to remove the date.
    expect(view.current.selectedDate).toBe('2026-08-12');
    expect(view.current.inputValue).toBe('2026-08-12');
    expect(onSelectDate).not.toHaveBeenCalled();
  });

  it('refuses a real date the calendar does not allow', () => {
    const view = mount({ defaultSelectedDate: '2026-08-12', minDate: '2026-08-10' });
    type(view, '2026-08-04');
    blur(view);
    expect(view.current.selectedDate).toBe('2026-08-12');
  });

  it('clears when the text is emptied', () => {
    const onSelectDate = vi.fn();
    const view = mount({ defaultSelectedDate: '2026-08-12', onSelectDate });
    type(view, '');
    blur(view);
    expect(view.current.selectedDate).toBeNull();
    expect(onSelectDate).toHaveBeenCalledWith(null);
  });

  it('commits nothing when the field was never edited', () => {
    const onSelectDate = vi.fn();
    const view = mount({ onSelectDate });
    blur(view);
    // Without the draft guard, tabbing through an empty field would read as
    // "cleared" and fire `onSelectDate(null)` at a caller who never touched it.
    expect(onSelectDate).not.toHaveBeenCalled();
  });

  it('closes on submit even with nothing to commit', () => {
    const view = mount({ defaultOpen: true });
    submit(view);
    expect(view.current.isOpen).toBe(false);
  });

  it('moves the grid to a complete date as it is typed', () => {
    const view = mount();
    type(view, '2026-11-20');
    expect(view.current.calendar.month).toBe('2026-11-01');
  });

  it('leaves the grid alone for a partial or blocked date', () => {
    const view = mount();
    type(view, '2026-11-');
    expect(view.current.calendar.month).toBe('2026-08-01');

    const bounded = mount({ maxDate: '2026-08-31' });
    type(bounded, '2026-11-20');
    expect(bounded.current.calendar.month).toBe('2026-08-01');
  });

  it('follows a committed date with the grid', () => {
    const view = mount();
    type(view, '2026-12-25');
    blur(view);
    expect(view.current.calendar.month).toBe('2026-12-01');
  });

  it('round-trips through a custom format', () => {
    // Deliberately US-order, the ambiguity the ISO default exists to avoid — a
    // consumer who wants it must opt in, and then it must work in both directions.
    const format: DateFieldFormat = {
      format: (date) => {
        const [year, month, day] = date.split('-');
        return `${month}/${day}/${year}`;
      },
      parse: (text) => {
        const match = US_DATE.exec(text.trim());
        return match === null ? null : `${match[3]}-${match[1]}-${match[2]}`;
      },
    };
    const view = mount({ format, defaultSelectedDate: '2026-08-12' });
    expect(view.current.inputValue).toBe('08/12/2026');
    type(view, '09/14/2026');
    blur(view);
    expect(view.current.selectedDate).toBe('2026-09-14');
    expect(view.current.inputValue).toBe('09/14/2026');
  });
});

describe('clearing', () => {
  it('empties the selection and the field', () => {
    const view = mount({ defaultSelectedDate: '2026-08-12' });
    view.act(() => view.current.clear());
    expect(view.current.selectedDate).toBeNull();
    expect(view.current.inputValue).toBe('');
  });

  it('discards a draft too', () => {
    const view = mount({ defaultSelectedDate: '2026-08-12' });
    type(view, '2026-09-');
    view.act(() => view.current.clear());
    expect(view.current.inputValue).toBe('');
  });

  it('offers nothing to clear until something is selected', () => {
    const view = mount();
    expect(view.current.getClearProps().disabled).toBe(true);
    pressDay(view, '2026-08-12');
    expect(view.current.getClearProps().disabled).toBe(false);
    view.act(() => view.current.getClearProps().onPress());
    expect(view.current.selectedDate).toBeNull();
  });
});
