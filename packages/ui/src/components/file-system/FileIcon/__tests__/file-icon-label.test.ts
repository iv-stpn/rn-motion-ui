import { describe, expect, it } from 'vitest';
import { FILE_BADGE_TRANSFORM } from '../file-icon';
import { type FileExtensionLabel, fileExtensionLabel } from '../file-icon-label';
import { FILE_BADGE_INK_BOTTOM, FILE_PAPER_INK, FILE_PAPER_SHEET } from '../file-icon-metrics';

/** The page's own ratio, so a width here maps to the height the icon really draws. */
const PAGE_ASPECT_RATIO = FILE_PAPER_INK.width / FILE_PAPER_INK.height;

/** A file icon as the views draw it: one width, and the height the page asks for. */
const drawnAt = (fileName: string, width: number) => fileExtensionLabel(fileName, width, width / PAGE_ASPECT_RATIO);

/** The sizes the app actually draws at — the list rows, and the icons grid's tile. */
const LIST_ROW_WIDTH = 16;
const GRID_TILE_WIDTH = 49;

describe('fileExtensionLabel', () => {
  it('prints the extension in uppercase, the way a macOS document icon does', () => {
    expect(drawnAt('Component.TsX', GRID_TILE_WIDTH)?.text).toBe('TSX');
  });

  it('leaves a file with no extension unlabelled', () => {
    expect(drawnAt('Makefile', GRID_TILE_WIDTH)).toBeNull();
  });

  it('stays off the icon in a list row, where it would be a smudge rather than a word', () => {
    expect(drawnAt('index.ts', LIST_ROW_WIDTH)).toBeNull();
  });

  it('appears once the icon is drawn big enough to read it', () => {
    expect(drawnAt('index.ts', GRID_TILE_WIDTH)).not.toBeNull();
  });

  it('drops the label when the height is squeezed, not just when the width is', () => {
    // The width says the label is legible; the height the caller chose says it is
    // a sliver. A stretched page is squeezed on one axis alone, so both are read.
    expect(fileExtensionLabel('index.ts', GRID_TILE_WIDTH, 12)).toBeNull();
  });
});

describe('fileExtensionLabel placement', () => {
  const label = drawnAt('index.ts', GRID_TILE_WIDTH);
  if (!label) throw new Error('expected a label at the grid tile size');

  it('centres the label on the page', () => {
    expect(label.x).toBeCloseTo(FILE_PAPER_SHEET.x + FILE_PAPER_SHEET.width / 2, 6);
  });

  it('keeps the whole label on the page, with a margin below it', () => {
    const sheetBottom = FILE_PAPER_SHEET.y + FILE_PAPER_SHEET.height;
    expect(label.y).toBeLessThan(sheetBottom);
    // A tenth of the page or so of white under the baseline, not a hairline.
    expect(sheetBottom - label.y).toBeGreaterThan(FILE_PAPER_SHEET.height * 0.08);
  });

  it('clears the badge drawn above it', () => {
    // No font's ascent exceeds its size, so a baseline one font-size below the
    // art is clear of it whatever face the platform picks.
    const badgeBottom = badgeToPaper(FILE_BADGE_INK_BOTTOM);
    expect(label.y - label.fontSize).toBeGreaterThan(badgeBottom);
  });
});

/**
 * A pessimistic uppercase advance, wider than any system sans — a label that fits
 * the page under this one fits under the font the platform actually picks.
 */
const WORST_CASE_ADVANCE = 0.8;
const widthUnder = (label: FileExtensionLabel) => label.text.length * (label.fontSize * WORST_CASE_ADVANCE + label.letterSpacing);

describe('fileExtensionLabel fitting', () => {
  it('shrinks a long extension rather than running it off the page', () => {
    const short = drawnAt('index.ts', GRID_TILE_WIDTH);
    const long = drawnAt('schema.graphql', GRID_TILE_WIDTH);
    expect(long?.fontSize).toBeLessThan(short?.fontSize ?? 0);
  });

  it('keeps the longest extension in the table inside the page', () => {
    // `.graphql` and `.command` are the seven-character worst case.
    for (const name of ['index.ts', 'schema.graphql', 'run.command']) {
      const label = drawnAt(name, GRID_TILE_WIDTH);
      if (!label) throw new Error(`expected a label for ${name}`);
      expect(widthUnder(label)).toBeLessThanOrEqual(FILE_PAPER_SHEET.width);
    }
  });

  it('leaves off an extension too long to read even shrunk to fit', () => {
    // Shrinking is what makes this one illegible, so the same floor catches it.
    expect(drawnAt('archive.thisisnotanextension', GRID_TILE_WIDTH)).toBeNull();
  });
});

const TRANSFORM_SHAPE = /^translate\((-?[\d.]+) (-?[\d.]+)\) scale\(([\d.]+)\)$/;

/** A y on the badge template, in the paper's coordinates — the transform, read back. */
function badgeToPaper(y: number): number {
  const match = TRANSFORM_SHAPE.exec(FILE_BADGE_TRANSFORM);
  if (!match) throw new Error(`unparseable transform: ${FILE_BADGE_TRANSFORM}`);
  return Number(match[2]) + Number(match[3]) * y;
}
