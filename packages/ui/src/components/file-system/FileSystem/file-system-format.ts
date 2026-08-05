// Byte-size and timestamp formatting. Decimal (SI) units, matching Finder's
// "on disk" figures rather than the binary ones.

const SIZE_UNITS = ['KB', 'MB', 'GB', 'TB'];
const BYTES_PER_UNIT = 1000;
/** Trailing zeros (and a bare decimal point) left by `toFixed`. */
const TRAILING_ZEROS = /\.?0+$/;

/** `1234` → `'1.23 KB'`; `undefined` → `null` (so callers can skip the row). */
export function formatByteSize(size: number | undefined): string | null {
  if (size === undefined) return null;
  if (size < BYTES_PER_UNIT) return `${size} bytes`;

  let value = size;
  for (const unit of SIZE_UNITS) {
    value /= BYTES_PER_UNIT;
    if (value < BYTES_PER_UNIT || unit === 'TB') {
      // Three significant figures, with trailing zeros trimmed.
      const decimals = value >= 10 ? 1 : 2;
      const formatted = value >= 100 ? String(Math.round(value)) : value.toFixed(decimals).replace(TRAILING_ZEROS, '');
      return `${formatted} ${unit}`;
    }
  }
  return null;
}

/** ISO string → `'3 Feb 2026 at 4:05 PM'`; invalid/absent input → `null`. */
export function formatTimestamp(value: string | undefined): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const day = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} at ${time}`;
}
