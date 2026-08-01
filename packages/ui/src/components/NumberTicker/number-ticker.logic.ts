const DIGIT_REGEX = /\d/;
const NON_DIGIT_REGEX = /\D/g;
/** `Intl` rejects `minimumIntegerDigits` past this. */
const MAX_INTL_INTEGER_DIGITS = 21;

/** Whether a glyph is a digit, and so rolls as a column instead of rendering flat. */
export function isDigit(char: string): boolean {
  return DIGIT_REGEX.test(char);
}

/** Prepend zeros until the leading run of digits is `pad` long, leaving a sign or
 *  affix ahead of it in place ("-42" -> "-000042", not "0-00042"). */
export function padDigits(text: string, pad: number): string {
  const start = text.search(DIGIT_REGEX);
  if (start < 0) return text;
  let end = start;
  while (isDigit(text.charAt(end))) end += 1;
  const missing = pad - (end - start);
  return missing > 0 ? `${text.slice(0, start)}${'0'.repeat(missing)}${text.slice(start)}` : text;
}

/** Clamped to what `Intl` accepts; 0 means "no padding". */
function padWidth(pad: number | undefined): number {
  return pad ? Math.max(1, Math.min(Math.trunc(pad), MAX_INTL_INTEGER_DIGITS)) : 0;
}

export function formatNumber(value: number, pad?: number, format?: (value: number) => string, locale?: boolean): string {
  // `pad` counts digits, so it has to be applied *during* formatting. Padding the
  // formatted string instead let group separators eat the width: "48,273" is
  // already 6 chars, so `pad: 6` did nothing, and "1,280" became "01,280".
  const width = padWidth(pad);
  if (format) {
    const formatted = format(value);
    return width ? padDigits(formatted, width) : formatted;
  }
  if (!locale) return width ? padDigits(value.toString(), width) : value.toString();
  if (!width) return value.toLocaleString();
  // Separators have to be laid out around the zeros ("000,042"), which is what
  // holds the column count fixed as the value grows — the point of a padded ticker.
  const grouped = value.toLocaleString(undefined, { minimumIntegerDigits: width });
  if (grouped.replace(NON_DIGIT_REGEX, '').length >= width) return grouped;
  // Hermes ships a subset of Intl. If it dropped the option, pad plain digits
  // rather than splice zeros into a grouped string and mangle the separators.
  return padDigits(value.toString(), width);
}
