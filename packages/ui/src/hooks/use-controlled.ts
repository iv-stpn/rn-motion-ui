import { useState } from 'react';

/** A value that is the consumer's when they pass one, and ours otherwise. */
export type ControlledValue<T> = { value: T; setValue: (next: T) => void };

/**
 * The controlled/uncontrolled seam — shared by every component that accepts an
 * optional controlled value with an `onChange` callback.
 *
 * `undefined` means "you are not controlling this"; `null` is a controlled
 * empty value, which is why the two are not collapsed into one falsy check.
 *
 * @example
 * // Generic form — useCalendar, RadioGroup, Tabs, CheckboxCard, …
 * const date = useControlledValue<ISODate | null>(selectedDate, null, onSelectDate);
 *
 * @example
 * // Boolean open/close state — useDatePicker, useDateRangePicker
 * const open = useControlledValue<boolean>(isOpen, false, onOpenChange);
 */
export function useControlledValue<T>(controlled: T | undefined, initial: T, onChange?: (next: T) => void): ControlledValue<T> {
  const [internal, setInternal] = useState<T>(initial);
  return {
    value: controlled === undefined ? internal : controlled,
    setValue: (next: T) => {
      if (controlled === undefined) setInternal(next);
      onChange?.(next);
    },
  };
}
