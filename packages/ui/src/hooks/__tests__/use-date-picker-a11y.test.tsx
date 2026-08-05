/**
 * The accessibility payload `useDatePicker` hands to a consumer.
 *
 * Kept apart from the behaviour suite because these are assertions about *claims*
 * rather than state — and because several are guarding a deliberate absence, which
 * is the kind of thing a later refactor helpfully "fixes" unless a test says why
 * the field is missing on purpose.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { mountPicker as mount, pressDay, unmountAll } from './date-picker-harness';

afterEach(unmountAll);
describe('accessibility and labels', () => {
  it('names the trigger with the date once there is one', () => {
    const view = mount();
    expect(view.current.getTriggerProps()['aria-label']).toBe('Choose date');
    pressDay(view, '2026-08-05');
    // Spoken, not the ISO string, and appended so the value is audible without
    // opening the panel.
    expect(view.current.getTriggerProps()['aria-label']).toBe('Choose date, August 5, 2026');
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
  });

  it('leaves the field without a role of its own', () => {
    const view = mount();
    const field = view.current.getFieldProps();
    // A `TextInput` already reads as an edit field; claiming a role would fight it.
    expect(Object.hasOwn(field, 'role')).toBe(false);
    expect(field.accessibilityLabel).toBe('Date');
    expect([field.autoCorrect, field.spellCheck]).toEqual([false, false]);
  });

  it('disables the field, the trigger and the clear button together', () => {
    const view = mount({ disabled: true, defaultSelectedDate: '2026-08-12' });
    expect(view.current.getFieldProps().editable).toBe(false);
    expect(view.current.getFieldProps()['aria-disabled']).toBe(true);
    expect(view.current.getTriggerProps().disabled).toBe(true);
    // Forced off even though there is a selection to clear.
    expect(view.current.getClearProps().disabled).toBe(true);
  });

  it('takes label overrides for every part', () => {
    const labels = { trigger: 'Pick a day', panel: 'Days', field: 'Departure', clear: 'Reset', dismiss: 'Dismiss' };
    const view = mount({ labels, defaultSelectedDate: '2026-08-12' });
    expect(view.current.getTriggerProps()['aria-label']).toBe('Pick a day');
    expect(view.current.getPanelProps()['aria-label']).toBe('Days');
    expect(view.current.getFieldProps()['aria-label']).toBe('Departure');
    expect(view.current.getClearProps()['aria-label']).toBe('Reset');
    expect(view.current.getDismissProps()['aria-label']).toBe('Dismiss');
  });

  it('derives its testIDs from the root, or emits none', () => {
    const view = mount({ testID: 'depart' });
    expect(view.current.getTriggerProps().testID).toBe('depart-trigger');
    expect(view.current.getPanelProps().testID).toBe('depart-panel');
    expect(view.current.getFieldProps().testID).toBe('depart-field');
    expect(view.current.getClearProps().testID).toBe('depart-clear');
    expect(view.current.getDismissProps().testID).toBe('depart-dismiss');
    // The calendar underneath shares the root, so one query prefix reaches all of it.
    expect(view.current.calendar.getRootProps().testID).toBe('depart');

    const anonymous = mount();
    expect(anonymous.current.getTriggerProps().testID).toBeUndefined();
  });
});
