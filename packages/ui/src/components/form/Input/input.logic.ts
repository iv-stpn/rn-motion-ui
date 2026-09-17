// Pure input semantics for the Input field, kept out of the component so the
// `inputType` → native-prop mapping can be unit-tested and reused by other
// text-field surfaces. Only type imports touch react-native (erased at runtime),
// so this module stays importable under vitest's node/jsdom env.

import type { KeyboardTypeOptions, TextInputProps } from 'react-native';

const AUTOCOMPLETE: Partial<Record<InputType, TextInputProps['autoComplete']>> = {
  name: 'name',
  email: 'email',
  otp: 'one-time-code',
  'new-password': 'new-password',
  password: 'password',
  phone: 'tel',
};

const KEYBOARD_TYPE: Partial<Record<InputType, KeyboardTypeOptions>> = {
  number: 'numeric',
  otp: 'number-pad',
  email: 'email-address',
  phone: 'phone-pad',
};

const TEXT_CONTENT_TYPE: Partial<Record<InputType, TextInputProps['textContentType']>> = {
  name: 'name',
  email: 'emailAddress',
  otp: 'oneTimeCode',
  'new-password': 'newPassword',
  password: 'password',
  phone: 'telephoneNumber',
};

/** Semantic input type — drives keyboard, autoComplete, and textContentType automatically. */
export type InputType = 'text' | 'name' | 'email' | 'number' | 'otp' | 'password' | 'new-password' | 'phone';

/** Field interaction state — error beats focus, focus beats idle. */
export type InputFieldState = 'error' | 'focused' | 'idle';

/** The native props a semantic `inputType` resolves to. */
export type ResolvedInputTypeProps = {
  autoComplete: TextInputProps['autoComplete'];
  keyboardType: KeyboardTypeOptions | undefined;
  textContentType: TextInputProps['textContentType'];
  autoCapitalize: 'sentences' | 'none';
  secureTextEntry: boolean;
};

/**
 * The native props a semantic `inputType` implies. `autoCapitalize` sentences
 * the two free-text types (`text`, `name`) and disables it everywhere else;
 * `secureTextEntry` is on for the two password types. Callers layer their own
 * explicit props over these defaults, so an explicit `keyboardType` still wins.
 */
export function resolveInputTypeProps(inputType: InputType): ResolvedInputTypeProps {
  return {
    autoComplete: AUTOCOMPLETE[inputType],
    keyboardType: KEYBOARD_TYPE[inputType],
    textContentType: TEXT_CONTENT_TYPE[inputType],
    autoCapitalize: inputType === 'name' || inputType === 'text' ? 'sentences' : 'none',
    secureTextEntry: inputType === 'password' || inputType === 'new-password',
  };
}

/** Resolve the field's interaction state: error beats focus, focus beats idle. */
export function resolveInputState(hasError: boolean, focused: boolean): InputFieldState {
  if (hasError) return 'error';
  if (focused) return 'focused';
  return 'idle';
}
