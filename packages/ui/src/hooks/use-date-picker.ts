/**
 * A headless date picker: one calendar, one text field, and the open/close state
 * that ties them together.
 *
 * Everything visual is yours. This hook owns the parts that are fiddly to get
 * right — a field that stays typeable while it disagrees with the selection, a
 * commit that refuses a day the grid would also refuse, and a blur that does not
 * steal the click that caused it.
 *
 * Renders nothing, imports no `react-native`, and composes {@link useCalendar}
 * rather than reimplementing it: the grid is reached through `calendar`, with all
 * of its getters.
 *
 * @example
 * ```tsx
 * const picker = useDatePicker({ onSelectDate: setDate, testID: 'due' });
 *
 * <TextInput {...picker.getFieldProps()} placeholder="YYYY-MM-DD" />
 * <Pressable {...picker.getTriggerProps()}><Text>Pick</Text></Pressable>
 *
 * {picker.isOpen ? (
 *   <Modal transparent={true} visible={true} onRequestClose={picker.close}>
 *     <Pressable {...picker.getDismissProps()} />
 *     <View {...picker.getPanelProps()}>
 *       <CalendarGrid calendar={picker.calendar} />
 *       <Pressable {...picker.getClearProps()}><Text>Clear</Text></Pressable>
 *     </View>
 *   </Modal>
 * ) : null}
 * ```
 */

import { useRef, useState } from 'react';

import type { ISODate } from '../lib/calendar';
import { type CalendarLocale, formatDateLabel } from '../lib/calendar-format';
import { isDayDisabled } from '../lib/calendar-selection';
import type { CalendarLabels, UseCalendarOptions, UseCalendarReturn } from '../lib/calendar-types';
import { type DateFieldFormat, fieldText, ISO_DATE_FIELD, resolveFieldCommit } from '../lib/date-field';
import {
  buildFieldProps,
  buildOverlayGetters,
  type DateFieldProps,
  type DateOverlayGetters,
  escapeHandler,
} from '../lib/date-picker-props';
import { useCalendar } from './use-calendar';

// Declared ahead of the exports to satisfy `useExportsLast`.

/** The open/closed state, controllable from outside. */
type Disclosure = { isOpen: boolean; setOpen: (next: boolean) => void };

/** Same controlled/uncontrolled seam the calendar uses, for one boolean. */
function useDisclosure(controlled: boolean | undefined, initial: boolean, onChange?: (open: boolean) => void): Disclosure {
  const [internal, setInternal] = useState(initial);
  return {
    isOpen: controlled === undefined ? internal : controlled,
    setOpen: (next: boolean) => {
      if (controlled === undefined) setInternal(next);
      onChange?.(next);
    },
  };
}

/**
 * The trigger's default name, which includes the current date.
 *
 * A button that only says "Choose date" gives a screen reader user no way to hear
 * what is already selected without opening the panel, so the date is appended
 * when there is one — spoken (`'August 5, 2026'`), not as the ISO string.
 */
function triggerLabel(selected: ISODate | null, locale?: CalendarLocale): string {
  return selected === null ? 'Choose date' : `Choose date, ${formatDateLabel(selected, locale)}`;
}

/** Accessible names for the picker's own parts, on top of the calendar's. */
export type DatePickerLabels = CalendarLabels & {
  /** The disclosure button. The current date is appended to the default. */
  trigger?: string;
  /** The panel holding the calendar. */
  panel?: string;
  /** The text field. */
  field?: string;
  clear?: string;
  /** The backdrop. */
  dismiss?: string;
};

/** Options for {@link useDatePicker}: the calendar's, plus the overlay and field. */
export type UseDatePickerOptions = Omit<UseCalendarOptions, 'mode' | 'labels'> & {
  /** Controlled open state. Omit to let the hook own it. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Pressing a day closes the panel. Default `true`. */
  closeOnSelect?: boolean;
  /** Focusing the field opens the panel. Default `false`. */
  openOnFocus?: boolean;
  /**
   * Whether the panel traps focus, which is what the modal flags claim. Default
   * `true`; pass `false` for a calendar rendered inline.
   */
  modal?: boolean;
  /** Whether a press on the backdrop closes. Default `true`. */
  dismissable?: boolean;
  /** Disables the trigger and the field, and forces the clear button off. */
  disabled?: boolean;
  /** How the field's text converts to a date and back. Default ISO both ways. */
  format?: DateFieldFormat;
  labels?: DatePickerLabels;
};

/** What {@link useDatePicker} returns. */
export type UseDatePickerReturn = DateOverlayGetters & {
  /** The grid, with every calendar getter. Render it inside the panel. */
  calendar: UseCalendarReturn;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  selectedDate: ISODate | null;
  /** The text in the field: the draft while typing, else the formatted selection. */
  inputValue: string;
  /** Empties the selection and the field. */
  clear: () => void;
  getFieldProps: () => DateFieldProps;
};

/**
 * A single-date picker with a calendar, a typeable field and an overlay — and no
 * opinion about how any of it looks.
 *
 * Uncontrolled by default. Pass `selectedDate`/`onSelectDate` to drive the value
 * and `open`/`onOpenChange` to drive the panel.
 */
export function useDatePicker(options: UseDatePickerOptions = {}): UseDatePickerReturn {
  const { closeOnSelect = true, disabled = false, format = ISO_DATE_FIELD, locale, testID } = options;
  const { isOpen, setOpen } = useDisclosure(options.open, options.defaultOpen ?? false, options.onOpenChange);
  // `null` means "not being edited": the field then shows the formatted selection.
  const [draft, setDraft] = useState<string | null>(null);
  // Set while a field commit is in flight, so the selection it makes does not
  // also close the panel — a blur-commit runs as focus moves *into* the panel,
  // and closing there would swallow the press that caused it.
  const fromField = useRef(false);

  const calendar = useCalendar({
    ...options,
    mode: 'single',
    onSelectDate: (date) => {
      setDraft(null);
      options.onSelectDate?.(date);
      if (closeOnSelect && date !== null && !fromField.current) setOpen(false);
    },
  });

  const selectedDate = calendar.selectedDate;

  const clear = () => {
    calendar.clearSelection();
    setDraft(null);
  };

  /**
   * Commits what was typed. `thenClose` is false on blur, true on the return key:
   * submitting is a deliberate "done", blurring may be a press on a day.
   *
   * A field nobody edited commits nothing: without the `draft` guard, merely
   * tabbing through an empty field would read as "cleared" and fire
   * `onSelectDate(null)` at a caller who never touched it.
   */
  const commitText = (text: string, thenClose: boolean) => {
    if (draft === null) {
      if (thenClose) setOpen(false);
      return;
    }
    const commit = resolveFieldCommit({ text, format, availability: options });
    // Unparseable text leaves the selection alone and snaps the field back to it,
    // rather than quietly discarding a date the user never asked to remove.
    setDraft(null);
    if (commit.kind === 'reject') return;
    if (commit.kind === 'clear') {
      calendar.clearSelection();
      return;
    }
    fromField.current = true;
    calendar.selectDate(commit.date);
    fromField.current = false;
    calendar.goToMonth(commit.date);
    if (thenClose) setOpen(false);
  };

  const onKeyDown = escapeHandler(isOpen, () => setOpen(false));

  const value = fieldText(draft, selectedDate, format);

  return {
    calendar,
    isOpen,
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!isOpen),
    selectedDate,
    inputValue: value,
    clear,
    getFieldProps: () =>
      buildFieldProps({
        testID,
        name: 'field',
        label: options.labels?.field ?? 'Date',
        value,
        disabled,
        handlers: {
          onChangeText: (text) => {
            setDraft(text);
            const parsed = format.parse(text);
            // A complete, allowed date moves the grid as you type, so the field
            // and the calendar never disagree about which month is on screen. The
            // options *are* a `DayAvailability`, so the bounds are read off them.
            if (parsed !== null && !isDayDisabled(parsed, options)) calendar.goToMonth(parsed);
          },
          onFocus: () => {
            if (options.openOnFocus ?? false) setOpen(true);
          },
          onBlur: () => commitText(value, false),
          onSubmit: () => commitText(value, true),
          onKeyDown,
        },
      }),
    ...buildOverlayGetters({
      testID,
      labels: options.labels,
      defaultTriggerLabel: triggerLabel(selectedDate, locale),
      defaultClearLabel: 'Clear date',
      disabled,
      isOpen,
      modal: options.modal ?? true,
      dismissable: options.dismissable ?? true,
      hasSelection: selectedDate !== null,
      toggle: () => setOpen(!isOpen),
      close: () => setOpen(false),
      clear,
      onKeyDown,
    }),
  };
}
