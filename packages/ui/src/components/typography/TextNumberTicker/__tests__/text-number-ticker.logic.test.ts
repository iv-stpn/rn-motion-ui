import { describe, expect, it } from 'vitest';
import { formatNumber, padDigits } from '../text-number-ticker.logic';

// The suite runs under whatever locale the host provides, so nothing asserts a
// separator character. Digits are compared directly; grouping is compared as a
// shape ("ddd,ddd") against a number the locale groups for real.
const digitsOf = (text: string) => text.replace(/\D/g, '');
const shapeOf = (text: string) => text.replace(/\d/g, 'd');

describe('padDigits', () => {
  it('pads the leading run of digits to the requested width', () => {
    expect(padDigits('42', 6)).toBe('000042');
    expect(padDigits('1280', 6)).toBe('001280');
  });

  it('leaves a value that already meets the width alone', () => {
    expect(padDigits('48273', 5)).toBe('48273');
    expect(padDigits('1234567', 6)).toBe('1234567');
  });

  it('keeps a sign ahead of the zeros', () => {
    expect(padDigits('-42', 6)).toBe('-000042');
  });

  it('measures the leading run only, so a separator cannot absorb the width', () => {
    // The bug this guards: "1,280" is 5 characters but 4 digits, and the old
    // padStart(6) counted the comma and stopped one zero short.
    expect(padDigits('1,280', 6)).toBe('000001,280');
  });

  it('returns text with no digits untouched', () => {
    expect(padDigits('—', 6)).toBe('—');
  });
});

describe('formatNumber', () => {
  it('stringifies plainly with no options', () => {
    expect(formatNumber(48_273)).toBe('48273');
  });

  it('pads to a digit count, not a character count', () => {
    expect(formatNumber(42, 6)).toBe('000042');
    expect(formatNumber(1280, 6)).toBe('001280');
  });

  it('treats a missing or zero pad as no padding', () => {
    expect(formatNumber(42, 0)).toBe('42');
    expect(formatNumber(42, undefined)).toBe('42');
  });

  it('truncates a fractional pad instead of throwing', () => {
    // `Intl` rejects a non-integer minimumIntegerDigits with a RangeError.
    expect(formatNumber(42, 6.7)).toBe('000042');
  });

  it('survives a pad past what Intl accepts', () => {
    expect(digitsOf(formatNumber(42, 99, undefined, true))).toHaveLength(21);
  });

  it('pads a negative value after the sign', () => {
    expect(formatNumber(-42, 6)).toBe('-000042');
  });

  it('defers to a custom formatter, then pads its digits', () => {
    expect(formatNumber(42, undefined, (v) => `#${v}`)).toBe('#42');
    expect(formatNumber(42, 6, (v) => `#${v}`)).toBe('#000042');
  });

  describe('locale', () => {
    it('groups without padding', () => {
      expect(formatNumber(48_273, undefined, undefined, true)).toBe((48_273).toLocaleString());
    });

    it('pads to the digit count rather than the string length', () => {
      // The regression: "48,273" is already 6 characters, so padStart(6) was a
      // no-op, and "1,280" padded to "01,280" instead of six digits.
      expect(digitsOf(formatNumber(48_273, 6, undefined, true))).toBe('048273');
      expect(digitsOf(formatNumber(1280, 6, undefined, true))).toBe('001280');
      expect(digitsOf(formatNumber(42, 6, undefined, true))).toBe('000042');
    });

    it('lays separators around the zeros', () => {
      // Padded 42 is grouped like a genuine 6-digit number, not left bare.
      expect(shapeOf(formatNumber(42, 6, undefined, true))).toBe(shapeOf((123_456).toLocaleString()));
    });

    it('holds one width across every value of the same padded digit count', () => {
      // Why a ticker pads at all: columns must not shift as the value grows.
      const widths = [42, 1280, 48_273, 999_999].map((v) => formatNumber(v, 6, undefined, true).length);
      expect(new Set(widths).size).toBe(1);
    });

    it('grows past the pad width without truncating', () => {
      expect(digitsOf(formatNumber(1_234_567, 6, undefined, true))).toBe('1234567');
    });
  });
});
