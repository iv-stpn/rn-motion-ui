/**
 * The headless date range picker: a two-month grid, a two-step selection loop, two
 * typeable fields and an overlay — with no opinion about how any of it looks.
 *
 * Composes {@link useCalendar} in `'range'` mode and adds the parts a range picker
 * needs beyond a grid: the preview band that follows the pointer while the second
 * endpoint is unchosen (the calendar already maintains it), a field per endpoint,
 * and closing once the range is complete rather than on the first press.
 *
 * Imports no `react-native`, like every module it builds on.
 *
 * @example
 * ```tsx
 * const picker = useDateRangePicker({ onSelectRange: setRange, testID: 'stay' });
 *
 * <TextInput {...picker.getStartFieldProps()} />
 * <TextInput {...picker.getEndFieldProps()} />
 * <Pressable {...picker.getTriggerProps()}><Text>Pick dates</Text></Pressable>
 * {picker.isOpen ? (
 *   <>
 *     <Pressable {...picker.getDismissProps()} />
 *     <View {...picker.getPanelProps()}>
 *       <CalendarGrid calendar={picker.calendar} />
 *       <Pressable {...picker.getClearProps()}><Text>Clear</Text></Pressable>
 *     </View>
 *   </>
 * ) : null}
 * ```
 */

import { useRef, useState } from 'react';

import { addMonths, type DateRange, type ISODate, isRangeComplete } from '../lib/calendar';
import { type CalendarLocale, formatRangeLabel } from '../lib/calendar-format';
import type { WebKeyEvent } from '../lib/calendar-props';
import { type DayAvailability, isDayDisabled } from '../lib/calendar-selection';
import type { CalendarLabels, UseCalendarOptions, UseCalendarReturn } from '../lib/calendar-types';
import { type DateFieldFormat, fieldText, ISO_DATE_FIELD, type RangeField, resolveRangeCommit } from '../lib/date-field';
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

/**
 * The same controlled/uncontrolled seam `useDatePicker` has, for one boolean.
 *
 * Deliberately duplicated between the two pickers rather than shared: `lib/` holds
 * no React, and promoting nine lines to a fourth public hook would widen the
 * package's API for something neither picker exposes.
 */
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

/** Both drafts. `null` for a field means it is not being edited right now. */
type Drafts = Record<RangeField, string | null>;

const NO_DRAFTS: Drafts = { start: null, end: null };

/** The fallback names for the two fields, when no label overrides them. */
const FIELD_LABELS: Record<RangeField, string> = { start: 'Start date', end: 'End date' };

/**
 * The trigger's default name, which includes the current range.
 *
 * Same reasoning as the single picker's: a button that only says "Choose dates"
 * leaves a screen reader user no way to hear what is already chosen without
 * opening the panel. A half-open range reads as its one end, which is what
 * `formatRangeLabel` already does.
 */
function triggerLabel(range: DateRange, locale?: CalendarLocale): string {
  const label = formatRangeLabel(range, locale);
  return label === '' ? 'Choose dates' : `Choose dates, ${label}`;
}

/**
 * Everything one field's props need from the hook, as one object.
 *
 * Extracted so the hook body stays inside the per-function line cap, and so the
 * two fields are provably identical apart from which end they edit.
 */
type FieldContext = {
  testID: string | undefined;
  labels: DateRangePickerLabels | undefined;
  disabled: boolean;
  openOnFocus: boolean;
  format: DateFieldFormat;
  availability: DayAvailability;
  setDraft: (field: RangeField, text: string | null) => void;
  commit: (field: RangeField, close: boolean) => void;
  reveal: (field: RangeField, date: ISODate) => void;
  setOpen: (next: boolean) => void;
  onKeyDown: (event: WebKeyEvent) => void;
};

/**
 * Which month to jump to so `date` is on screen for `field`.
 *
 * The end field aims to put its date in the *last* month shown rather than the
 * first, so a two-month view keeps the start visible beside it instead of paging
 * past it.
 */
function revealMonth(field: RangeField, date: ISODate, months: number): ISODate {
  return field === 'end' ? addMonths(date, -(months - 1)) : date;
}

/** One field's props: the same shape for both ends, parameterised by which one. */
function rangeFieldProps(context: FieldContext, field: RangeField, value: string): DateFieldProps {
  const { labels, format, availability } = context;
  const override = field === 'start' ? labels?.startField : labels?.endField;
  return buildFieldProps({
    testID: context.testID,
    name: `${field}-field`,
    label: override ?? FIELD_LABELS[field],
    value,
    disabled: context.disabled,
    handlers: {
      onChangeText: (text) => {
        context.setDraft(field, text);
        // A complete, allowed date moves the grid as you type, so the fields and
        // the calendar never disagree about which months are on screen.
        const parsed = format.parse(text);
        if (parsed !== null && !isDayDisabled(parsed, availability)) context.reveal(field, parsed);
      },
      onFocus: () => {
        if (context.openOnFocus) context.setOpen(true);
      },
      onBlur: () => context.commit(field, false),
      onSubmit: () => context.commit(field, true),
      onKeyDown: context.onKeyDown,
    },
  });
}

/** Accessible names for the picker's own parts, on top of the calendar's. */
export type DateRangePickerLabels = CalendarLabels & {
  /** The disclosure button. The current range is appended to the default. */
  trigger?: string;
  /** The panel holding the calendar. */
  panel?: string;
  startField?: string;
  endField?: string;
  clear?: string;
  /** The backdrop. */
  dismiss?: string;
};

/** Options for {@link useDateRangePicker}: the calendar's, plus the overlay and fields. */
export type UseDateRangePickerOptions = Omit<UseCalendarOptions, 'mode' | 'labels'> & {
  /** Controlled open state. Omit to let the hook own it. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Closes the panel once both ends are chosen — not on the first press, which
   * only starts the range. Default `true`.
   */
  closeOnComplete?: boolean;
  /** Focusing a field opens the panel. Default `false`. */
  openOnFocus?: boolean;
  /**
   * Whether the panel traps focus, which is what the modal flags claim. Default
   * `true`; pass `false` for a calendar rendered inline.
   */
  modal?: boolean;
  /** Whether a press on the backdrop closes. Default `true`. */
  dismissable?: boolean;
  /** Disables the trigger and both fields, and forces the clear button off. */
  disabled?: boolean;
  /** How each field's text converts to a date and back. Default ISO both ways. */
  format?: DateFieldFormat;
  labels?: DateRangePickerLabels;
};

/** What {@link useDateRangePicker} returns. */
export type UseDateRangePickerReturn = DateOverlayGetters & {
  /** The grid, with every calendar getter. Render it inside the panel. */
  calendar: UseCalendarReturn;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  selectedRange: DateRange;
  /** Whether both ends are chosen. A half-open range is not complete. */
  isComplete: boolean;
  /** The text in the start field: its draft while typing, else the formatted start. */
  startValue: string;
  /** The text in the end field: its draft while typing, else the formatted end. */
  endValue: string;
  /** Empties the range and both fields. */
  clear: () => void;
  getStartFieldProps: () => DateFieldProps;
  getEndFieldProps: () => DateFieldProps;
};

/**
 * A date range picker: two months, a two-step selection loop, a field per endpoint
 * and an overlay.
 *
 * Uncontrolled by default. Pass `selectedRange`/`onSelectRange` to drive the value
 * and `open`/`onOpenChange` to drive the panel.
 */
export function useDateRangePicker(options: UseDateRangePickerOptions = {}): UseDateRangePickerReturn {
  const { closeOnComplete = true, disabled = false, format = ISO_DATE_FIELD, locale, testID } = options;
  const { isOpen, setOpen } = useDisclosure(options.open, options.defaultOpen ?? false, options.onOpenChange);
  const [drafts, setDrafts] = useState<Drafts>(NO_DRAFTS);
  // Set while a field commit is in flight, so the range it sets does not also
  // close the panel — a blur-commit runs as focus moves *into* the panel, and
  // closing there would swallow the press that caused it.
  const fromField = useRef(false);
  const months = Math.max(1, options.numberOfMonths ?? 2);

  const calendar = useCalendar({
    ...options,
    mode: 'range',
    numberOfMonths: months,
    onSelectRange: (next) => {
      setDrafts(NO_DRAFTS);
      options.onSelectRange?.(next);
      if (closeOnComplete && isRangeComplete(next) && !fromField.current) setOpen(false);
    },
  });

  const range = calendar.selectedRange;

  const clear = () => {
    calendar.clearSelection();
    setDrafts(NO_DRAFTS);
  };

  const setDraft = (field: RangeField, text: string | null) => setDrafts((current) => ({ ...current, [field]: text }));

  const reveal = (field: RangeField, date: ISODate) => calendar.goToMonth(revealMonth(field, date, months));

  /**
   * Commits one field's text. `thenClose` is false on blur, true on the return
   * key: submitting is a deliberate "done", blurring may be a press on a day.
   */
  const commitText = (field: RangeField, thenClose: boolean) => {
    const text = drafts[field];
    // Not edited, so there is nothing to commit — and nothing to snap back. The
    // return key still counts as "done" and closes, matching the single picker.
    if (text === null) {
      if (thenClose) setOpen(false);
      return;
    }
    const commit = resolveRangeCommit({ range, field, text, format, availability: options });
    // Text that does not parse leaves the range alone and snaps the field back to
    // it, rather than quietly discarding an end the user never asked to remove.
    setDraft(field, null);
    if (commit.kind === 'reject') return;
    fromField.current = true;
    calendar.setRange(commit.range);
    fromField.current = false;
    // The typed date, not the committed one: a reversed pair is normalised on the
    // way in, and the user should still see the day they just typed.
    const typed = format.parse(text);
    if (typed !== null) reveal(field, typed);
    if (thenClose) setOpen(false);
  };

  const close = () => setOpen(false);
  const toggle = () => setOpen(!isOpen);
  const onKeyDown = escapeHandler(isOpen, close);

  const startValue = fieldText(drafts.start, range.start, format);
  const endValue = fieldText(drafts.end, range.end, format);

  const fields: FieldContext = {
    testID,
    labels: options.labels,
    disabled,
    format,
    // The options *are* a `DayAvailability` — the same three optional fields — so
    // the bounds are read straight off them rather than copied into a second object.
    availability: options,
    openOnFocus: options.openOnFocus ?? false,
    setDraft,
    commit: commitText,
    reveal,
    setOpen,
    onKeyDown,
  };

  return {
    calendar,
    isOpen,
    open: () => setOpen(true),
    close,
    toggle,
    selectedRange: range,
    isComplete: isRangeComplete(range),
    startValue,
    endValue,
    clear,
    getStartFieldProps: () => rangeFieldProps(fields, 'start', startValue),
    getEndFieldProps: () => rangeFieldProps(fields, 'end', endValue),
    ...buildOverlayGetters({
      testID,
      labels: options.labels,
      defaultTriggerLabel: triggerLabel(range, locale),
      defaultClearLabel: 'Clear dates',
      disabled,
      isOpen,
      modal: options.modal ?? true,
      dismissable: options.dismissable ?? true,
      // Either end counts: a half-open range is still something to clear.
      hasSelection: range.start !== null || range.end !== null,
      toggle,
      close,
      clear,
      onKeyDown,
    }),
  };
}
