/**
 * The accessibility payload `useDateRangePicker` hands to a consumer.
 *
 * Split from the behaviour suite for the same reason the single picker's is: these
 * assert *claims* rather than state, and several guard a deliberate absence — the
 * kind of thing a later refactor helpfully "fixes" unless a test says why the field
 * is missing on purpose.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { field, mountRangePicker as mount, pressDay, unmountAll } from './date-range-picker-harness';

afterEach(unmountAll);

describe('accessibility and labels', () => {
  it('names the trigger with the range once there is one', () => {
    const view = mount({ defaultOpen: true });
    expect(view.current.getTriggerProps()['aria-label']).toBe('Choose dates');

    pressDay(view, '2026-08-10');
    // A half-open range reads as its one end rather than as a span with a hole in it.
    expect(view.current.getTriggerProps()['aria-label']).toBe('Choose dates, August 10, 2026');

    pressDay(view, '2026-08-20');
    // Spoken, not the ISO pair, and appended so the value is audible without
    // opening the panel.
    expect(view.current.getTriggerProps()['aria-label']).toBe('Choose dates, August 10, 2026 – August 20, 2026');
  });

  it('names each field for the end it edits', () => {
    const view = mount();
    expect(field(view, 'start').accessibilityLabel).toBe('Start date');
    expect(field(view, 'end').accessibilityLabel).toBe('End date');
    // Both forms, since react-native-web reads only the `aria-` one.
    expect(field(view, 'start')['aria-label']).toBe('Start date');
    expect(field(view, 'end')['aria-label']).toBe('End date');
  });

  it('claims a modal dialog, on all three flags together', () => {
    const view = mount({ defaultOpen: true });
    expect(view.current.getPanelProps()).toMatchObject({
      role: 'dialog',
      'aria-label': 'Calendar',
      'aria-modal': true,
      accessibilityViewIsModal: true,
    });

    const inline = mount({ modal: false });
    // An inline calendar must not claim focus containment it does not have.
    expect(inline.current.getPanelProps()['aria-modal']).toBe(false);
    expect(inline.current.getPanelProps().accessibilityViewIsModal).toBe(false);
  });

  it('is a button with aria-expanded, not a combobox', () => {
    const view = mount();
    const trigger = view.current.getTriggerProps();
    // RN has no `aria-controls`, so a combobox would announce a popup assistive
    // tech cannot then find. A button that reports its expansion is honest.
    expect([trigger.role, trigger.accessibilityRole]).toEqual(['button', 'button']);
    expect(Object.hasOwn(trigger, 'aria-haspopup')).toBe(false);
    expect(trigger['aria-expanded']).toBe(false);
  });

  it('leaves both fields without a role of their own', () => {
    const view = mount();
    for (const which of ['start', 'end'] as const) {
      const props = field(view, which);
      // A `TextInput` already reads as an edit field; claiming a role would fight it.
      expect(Object.hasOwn(props, 'role')).toBe(false);
      // A date is not prose, so autocorrect and spellcheck only fight the typist.
      expect([props.autoCorrect, props.spellCheck]).toEqual([false, false]);
    }
  });

  it('disables both fields, the trigger and the clear button together', () => {
    const view = mount({ disabled: true, defaultSelectedRange: { start: '2026-08-10', end: '2026-08-20' } });
    expect(field(view, 'start').editable).toBe(false);
    expect(field(view, 'end').editable).toBe(false);
    expect(field(view, 'end')['aria-disabled']).toBe(true);
    expect(view.current.getTriggerProps().disabled).toBe(true);
    // Forced off even though there is a range to clear.
    expect(view.current.getClearProps().disabled).toBe(true);
  });

  it('takes label overrides for every part', () => {
    const labels = {
      trigger: 'Pick your stay',
      panel: 'Nights',
      startField: 'Check in',
      endField: 'Check out',
      clear: 'Reset',
      dismiss: 'Dismiss',
    };
    const view = mount({ labels, defaultSelectedRange: { start: '2026-08-10', end: '2026-08-20' } });
    expect(view.current.getTriggerProps()['aria-label']).toBe('Pick your stay');
    expect(view.current.getPanelProps()['aria-label']).toBe('Nights');
    expect(field(view, 'start')['aria-label']).toBe('Check in');
    expect(field(view, 'end')['aria-label']).toBe('Check out');
    expect(view.current.getClearProps()['aria-label']).toBe('Reset');
    expect(view.current.getDismissProps()['aria-label']).toBe('Dismiss');
  });

  it('derives its testIDs from the root, or emits none', () => {
    const view = mount({ testID: 'stay' });
    expect(view.current.getTriggerProps().testID).toBe('stay-trigger');
    expect(view.current.getPanelProps().testID).toBe('stay-panel');
    expect(field(view, 'start').testID).toBe('stay-start-field');
    expect(field(view, 'end').testID).toBe('stay-end-field');
    expect(view.current.getClearProps().testID).toBe('stay-clear');
    expect(view.current.getDismissProps().testID).toBe('stay-dismiss');
    // The calendar underneath shares the root, so one query prefix reaches all of it.
    expect(view.current.calendar.getRootProps().testID).toBe('stay');

    const anonymous = mount();
    expect(anonymous.current.getTriggerProps().testID).toBeUndefined();
    expect(field(anonymous, 'start').testID).toBeUndefined();
  });
});
