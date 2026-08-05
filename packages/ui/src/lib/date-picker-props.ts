/**
 * The prop objects the date pickers hand to a consumer, beyond the calendar's own.
 *
 * Same rules as `calendar-props`: pure, React-free, and structurally assignable
 * to React Native props rather than importing them, so every shape is assertable
 * in a bare jsdom test.
 *
 * ## What these claim, and what they cannot
 *
 * The trigger is a **button** carrying `aria-expanded`, which is this repo's own
 * pattern for a disclosure (see `Popover`'s trigger). It is deliberately not a
 * `combobox`: ARIA's combobox pattern leans on `aria-controls` to point at the
 * popup, and React Native's prop surface has neither `aria-controls` nor
 * `aria-haspopup`. A combobox without them announces a control whose popup
 * assistive tech cannot then find — worse than a plain expanded/collapsed button.
 *
 * The text field claims no role at all. A `TextInput` already reads as an edit
 * field on every platform, and the panel it opens is described by the trigger
 * beside it.
 *
 * The panel is a `dialog`, matching `Overlay`'s shell: `role` for web,
 * `accessibilityViewIsModal` for iOS, `aria-modal` for react-native-web. All
 * three follow the `modal` flag, so an inline calendar never claims to trap focus
 * that nothing has trapped.
 *
 * `onKeyDown` is web-only, as in `calendar-props`: react-native-web forwards it,
 * native never fires it, so it is inert on a device rather than wrong.
 */

import { buildNavProps, type CalendarNavProps, type WebKeyEvent } from './calendar-props';
import { deriveTestID } from './calendar-test-id';

/** The callbacks a date text field routes back to its hook. */
export type DateFieldHandlers = {
  onChangeText: (text: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  /** The keyboard's submit/return key. */
  onSubmit: () => void;
  onKeyDown: (event: WebKeyEvent) => void;
};

/** Props for a date text field, spreadable onto a `TextInput`. */
export type DateFieldProps = {
  testID: string | undefined;
  /** The text to display: the draft while typing, else the formatted selection. */
  value: string;
  accessibilityLabel: string;
  'aria-label': string;
  accessibilityState: { disabled: boolean };
  'aria-disabled': boolean;
  /** `TextInput`'s own disabled flag. */
  editable: boolean;
  /** A date is not prose; autocorrect and spellcheck only fight the typist. */
  autoCorrect: false;
  spellCheck: false;
  onChangeText: (text: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onSubmitEditing: () => void;
  onKeyDown: (event: WebKeyEvent) => void;
};

/** What {@link buildFieldProps} needs, as one object so it stays inside the 4-param cap. */
export type FieldPropsOptions = {
  testID: string | undefined;
  /** `'field'`, `'start-field'`, `'end-field'` — also the testID suffix. */
  name: string;
  label: string;
  value: string;
  disabled: boolean;
  handlers: DateFieldHandlers;
};

/** One date text field. */
export function buildFieldProps({ testID, name, label, value, disabled, handlers }: FieldPropsOptions): DateFieldProps {
  return {
    testID: deriveTestID(testID, name),
    value,
    accessibilityLabel: label,
    'aria-label': label,
    accessibilityState: { disabled },
    'aria-disabled': disabled,
    editable: !disabled,
    autoCorrect: false,
    spellCheck: false,
    onChangeText: handlers.onChangeText,
    onFocus: handlers.onFocus,
    onBlur: handlers.onBlur,
    onSubmitEditing: handlers.onSubmit,
    onKeyDown: handlers.onKeyDown,
  };
}

/** Props for the element that opens the panel. */
export type DateTriggerProps = {
  testID: string | undefined;
  accessibilityRole: 'button';
  role: 'button';
  accessibilityLabel: string;
  'aria-label': string;
  /** `expanded` is the whole point: it is what says the calendar is open. */
  accessibilityState: { disabled: boolean; expanded: boolean };
  'aria-expanded': boolean;
  'aria-disabled': boolean;
  disabled: boolean;
  onPress: () => void;
};

/** What {@link buildTriggerProps} needs, as one object. */
export type TriggerPropsOptions = {
  testID: string | undefined;
  label: string;
  disabled: boolean;
  expanded: boolean;
  onPress: () => void;
};

/** The disclosure button. */
export function buildTriggerProps({ testID, label, disabled, expanded, onPress }: TriggerPropsOptions): DateTriggerProps {
  return {
    testID: deriveTestID(testID, 'trigger'),
    accessibilityRole: 'button',
    role: 'button',
    accessibilityLabel: label,
    'aria-label': label,
    accessibilityState: { disabled, expanded },
    'aria-expanded': expanded,
    'aria-disabled': disabled,
    disabled,
    onPress,
  };
}

/** Props for the panel holding the calendar. */
export type DatePanelProps = {
  testID: string | undefined;
  role: 'dialog';
  accessibilityLabel: string;
  'aria-label': string;
  'aria-modal': boolean;
  accessibilityViewIsModal: boolean;
  /** Web-only: lets a consumer close on `Escape` by spreading rather than wiring. */
  onKeyDown: (event: WebKeyEvent) => void;
};

/** What {@link buildPanelProps} needs, as one object. */
export type PanelPropsOptions = {
  testID: string | undefined;
  label: string;
  /** Whether the panel traps focus. Drives both modal flags, so neither over-claims. */
  modal: boolean;
  onKeyDown: (event: WebKeyEvent) => void;
};

/** The calendar's container. */
export function buildPanelProps({ testID, label, modal, onKeyDown }: PanelPropsOptions): DatePanelProps {
  return {
    testID: deriveTestID(testID, 'panel'),
    role: 'dialog',
    accessibilityLabel: label,
    'aria-label': label,
    'aria-modal': modal,
    accessibilityViewIsModal: modal,
    onKeyDown,
  };
}

/**
 * A labelled button that may be disabled — the same shape a month-stepping button
 * has, so the clear button reuses `buildNavProps` rather than restating it.
 */
export type DateButtonProps = CalendarNavProps;

/** The clear button, which empties the selection. Disabled when there is nothing to clear. */
export function buildClearProps(
  testID: string | undefined,
  label: string,
  disabled: boolean,
  onPress: () => void,
): DateButtonProps {
  return buildNavProps({ testID, name: 'clear', label, disabled, onPress });
}

/**
 * Props for a dismiss layer — the backdrop behind the panel.
 *
 * No role: a scrim is not a button, and the repo's own overlays label it without
 * claiming one (see `Drawer`). Assistive tech reaches the close action through the
 * trigger's `aria-expanded`, not through the scrim.
 */
export type DateDismissProps = {
  testID: string | undefined;
  accessibilityLabel: string;
  'aria-label': string;
  disabled: boolean;
  onPress: () => void;
};

/** The backdrop. `disabled` when the panel is not dismissable by an outside press. */
export function buildDismissProps(
  testID: string | undefined,
  label: string,
  dismissable: boolean,
  onPress: () => void,
): DateDismissProps {
  return {
    testID: deriveTestID(testID, 'dismiss'),
    accessibilityLabel: label,
    'aria-label': label,
    disabled: !dismissable,
    onPress,
  };
}

/**
 * The Escape handler both pickers give their panel and their fields.
 *
 * `preventDefault` is called only when there is actually a panel to close, so a
 * closed picker leaves the key alone — Escape may mean something to whatever is
 * around it (reverting a form, dismissing a parent sheet), and swallowing it
 * unconditionally would break that.
 *
 * Web-only, like every `onKeyDown` here: react-native-web forwards it, native
 * never fires it.
 */
export function escapeHandler(isOpen: boolean, close: () => void): (event: WebKeyEvent) => void {
  return (event) => {
    if (event.key !== 'Escape' || !isOpen) return;
    event.preventDefault();
    close();
  };
}

/**
 * The getters both pickers share. Only the fields differ between them — one date
 * takes one field, a range takes two — so those stay with each hook.
 */
export type DateOverlayGetters = {
  getTriggerProps: () => DateTriggerProps;
  getPanelProps: () => DatePanelProps;
  getDismissProps: () => DateDismissProps;
  getClearProps: () => DateButtonProps;
};

/**
 * The overlay labels a consumer may override. Each field's own label stays with
 * its hook, since one picker has a single field and the other has two.
 */
export type OverlayLabels = { trigger?: string; panel?: string; clear?: string; dismiss?: string };

/** Everything {@link buildOverlayGetters} closes over, as one object. */
export type OverlayGetterContext = {
  testID: string | undefined;
  labels: OverlayLabels | undefined;
  /** Used when `labels.trigger` is absent. Each picker spells its own, with the value in it. */
  defaultTriggerLabel: string;
  /** Used when `labels.clear` is absent — "Clear date" for one, "Clear dates" for a range. */
  defaultClearLabel: string;
  /** Disables the trigger and the field, and forces the clear button off. */
  disabled: boolean;
  isOpen: boolean;
  modal: boolean;
  dismissable: boolean;
  /** Whether there is anything to clear, which is what enables the clear button. */
  hasSelection: boolean;
  toggle: () => void;
  close: () => void;
  clear: () => void;
  onKeyDown: (event: WebKeyEvent) => void;
};

/**
 * The four shared getters, bound to one render's resolved state.
 *
 * The fallback names live here rather than in each hook so the two pickers cannot
 * drift apart on the parts they share — only the two that differ are passed in.
 */
export function buildOverlayGetters(context: OverlayGetterContext): DateOverlayGetters {
  const { testID, labels, disabled } = context;
  const trigger = labels?.trigger ?? context.defaultTriggerLabel;
  const clear = labels?.clear ?? context.defaultClearLabel;
  return {
    getTriggerProps: () =>
      buildTriggerProps({ testID, label: trigger, disabled, expanded: context.isOpen, onPress: context.toggle }),
    getPanelProps: () =>
      buildPanelProps({ testID, label: labels?.panel ?? 'Calendar', modal: context.modal, onKeyDown: context.onKeyDown }),
    getDismissProps: () => buildDismissProps(testID, labels?.dismiss ?? 'Close', context.dismissable, context.close),
    getClearProps: () => buildClearProps(testID, clear, disabled || !context.hasSelection, context.clear),
  };
}
