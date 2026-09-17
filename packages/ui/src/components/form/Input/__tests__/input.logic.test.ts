import { describe, expect, it } from 'vitest';
import { resolveInputState, resolveInputTypeProps } from '../input.logic';

describe('resolveInputTypeProps', () => {
  it('leaves the plain text type with sentence capitalisation and no extras', () => {
    expect(resolveInputTypeProps('text')).toEqual({
      autoComplete: undefined,
      keyboardType: undefined,
      textContentType: undefined,
      autoCapitalize: 'sentences',
      secureTextEntry: false,
    });
  });

  it('wires the email type to its keyboard, autoComplete and textContentType', () => {
    expect(resolveInputTypeProps('email')).toMatchObject({
      keyboardType: 'email-address',
      autoComplete: 'email',
      textContentType: 'emailAddress',
      autoCapitalize: 'none',
      secureTextEntry: false,
    });
  });

  it('maps each semantic type to the right native props', () => {
    expect(resolveInputTypeProps('number')).toMatchObject({ keyboardType: 'numeric' });
    expect(resolveInputTypeProps('otp')).toMatchObject({
      keyboardType: 'number-pad',
      autoComplete: 'one-time-code',
      textContentType: 'oneTimeCode',
    });
    expect(resolveInputTypeProps('phone')).toMatchObject({
      keyboardType: 'phone-pad',
      autoComplete: 'tel',
      textContentType: 'telephoneNumber',
    });
    expect(resolveInputTypeProps('name')).toMatchObject({ autoComplete: 'name', textContentType: 'name' });
  });

  it('enables secure entry for both password types and disables autoCapitalize', () => {
    expect(resolveInputTypeProps('password')).toMatchObject({
      secureTextEntry: true,
      textContentType: 'password',
      autoCapitalize: 'none',
    });
    expect(resolveInputTypeProps('new-password')).toMatchObject({
      secureTextEntry: true,
      autoComplete: 'new-password',
      textContentType: 'newPassword',
      autoCapitalize: 'none',
    });
  });
});

describe('resolveInputState', () => {
  it('prioritises error over focus', () => {
    expect(resolveInputState(true, false)).toBe('error');
    expect(resolveInputState(true, true)).toBe('error');
  });

  it('resolves focus and idle', () => {
    expect(resolveInputState(false, true)).toBe('focused');
    expect(resolveInputState(false, false)).toBe('idle');
  });
});
