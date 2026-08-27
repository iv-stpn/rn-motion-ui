// The extension label: a file's extension in uppercase, printed on the page
// below the badge the way macOS prints it on a document icon.
//
// Only the category badges get one. A brand logo is drawn full-bleed with no
// page under it — there is no margin to print in, and the mark already says what
// the file is.
//
// RN-free, like `file-icon.ts`: this solves the geometry in the paper's own
// coordinates and the render layer draws it.

import { fileExtension } from '../FileSystem/logic/file-system-paths';
import { FILE_PAPER_INK, FILE_PAPER_SHEET } from './file-icon-metrics';

/**
 * Where the label sits, in fractions of the sheet.
 *
 * Solved against the band the badges leave free: the lowest-drawing glyph in the
 * set bottoms out at 73.5% of the sheet, and these put the label's cap top at
 * 78.8% and its baseline at 88.5%, so it clears the art above it and keeps a
 * margin below it roughly the depth of its own caps.
 */
const LABEL_FONT_SIZE = 0.135;
const LABEL_BASELINE = 0.885;
const LABEL_MAX_WIDTH = 0.86;

/** Extra tracking, in ems: uppercase set solid reads as a block at icon sizes. */
const LABEL_TRACKING = 0.06;

/**
 * Cap height and uppercase advance, as fractions of the font size, for the system
 * sans the label is set in. Both are estimates — the platform picks the font, so
 * neither is knowable here — and both only ever decide a *size*: `textAnchor`
 * does the centring, so a font that runs wider than estimated eats into the
 * label's own margin rather than off the page.
 */
const CAP_HEIGHT = 0.72;
const UPPERCASE_ADVANCE = 0.7;

/**
 * The smallest the label may be drawn before it is left off instead, in px: cap
 * height on the vertical, one character's advance on the horizontal. Below these
 * it is a gray smudge rather than a word — which is every list row, at the 16–20px
 * those draw at, and is why macOS leaves the text off the small representations
 * in an `.icns` too. In practice the label appears from about 40px of width up.
 *
 * Both axes are checked because a caller may override the height, and a page
 * stretched into a box the layout chose is squeezed on one axis alone.
 */
const MIN_CAP_HEIGHT_PX = 4.5;
const MIN_ADVANCE_PX = 2.5;

/**
 * The label's ink: a light gray, fixed rather than themed. It is printed on the
 * icon's white paper whatever is behind the icon, so — like the badge above it —
 * it belongs to a picture of a file rather than to a symbol that follows the
 * theme.
 */
export const FILE_EXTENSION_LABEL_COLOR = '#9a9aa1';

/** A drawn extension label, in the paper's own 128-square. */
export type FileExtensionLabel = { fontSize: number; letterSpacing: number; text: string; x: number; y: number };

/**
 * The extension label for a file drawn at `width`×`height` px, or `null` when
 * there is nothing to print or no room to print it legibly.
 *
 * The geometry comes back in the paper's coordinates, so the render layer drops
 * it into the same `<Svg>` as the page and the badge with no further maths.
 */
export function fileExtensionLabel(fileName: string, width: number, height: number): FileExtensionLabel | null {
  const text = fileExtension(fileName).toUpperCase();
  if (!text) return null;

  // A long extension shrinks to fit the page rather than running off it:
  // `.graphql` and `.command` are both seven characters, and an extension the
  // table has never seen has no bound at all.
  const fontSize = Math.min(
    FILE_PAPER_SHEET.height * LABEL_FONT_SIZE,
    (FILE_PAPER_SHEET.width * LABEL_MAX_WIDTH) / (text.length * (UPPERCASE_ADVANCE + LABEL_TRACKING)),
  );

  // Measured against the drawn box rather than the nominal size, and after the
  // shrink: shrinking to fit is what makes a long extension illegible, so one
  // floor catches both it and an icon simply drawn small.
  const capHeightPx = fontSize * CAP_HEIGHT * (height / FILE_PAPER_INK.height);
  const advancePx = fontSize * UPPERCASE_ADVANCE * (width / FILE_PAPER_INK.width);
  if (capHeightPx < MIN_CAP_HEIGHT_PX || advancePx < MIN_ADVANCE_PX) return null;

  return {
    fontSize,
    letterSpacing: fontSize * LABEL_TRACKING,
    text,
    x: FILE_PAPER_SHEET.x + FILE_PAPER_SHEET.width / 2,
    y: FILE_PAPER_SHEET.y + FILE_PAPER_SHEET.height * LABEL_BASELINE,
  };
}
