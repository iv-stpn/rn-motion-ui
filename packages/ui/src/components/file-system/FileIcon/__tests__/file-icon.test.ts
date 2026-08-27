import { describe, expect, it } from 'vitest';
import {
  FILE_BADGE_TRANSFORM,
  fileIconAspectRatio,
  fileIconBadgeColor,
  fileIconWidthForBox,
  isFileIconBrand,
  resolveFileIcon,
} from '../file-icon';
import { FILE_BADGE_SHEET, FILE_PAPER_INK, FILE_PAPER_SHEET } from '../file-icon-metrics';

/**
 * The paper's ink — a portrait page. Read off the metrics rather than copied:
 * it is a measurement of the source art, so it moves whenever the art does.
 */
const PAGE_ASPECT_RATIO = FILE_PAPER_INK.width / FILE_PAPER_INK.height;

describe('resolveFileIcon', () => {
  it('resolves a known extension to its category glyph and colour', () => {
    expect(resolveFileIcon('app.tsx')).toEqual({ name: 'FileCode', token: 'code' });
  });

  it('falls back to a plain document for an unknown extension', () => {
    expect(resolveFileIcon('notes.wat')).toEqual({ name: 'FileDocument', token: 'default' });
  });

  it('resolves brands, which carry no colour token of their own', () => {
    expect(resolveFileIcon('report.pdf')).toEqual({ name: 'FilePdf', token: 'default' });
  });
});

describe('isFileIconBrand', () => {
  it('separates the full-bleed logos from the tintable categories', () => {
    expect(isFileIconBrand('FileWord')).toBe(true);
    expect(isFileIconBrand('FileCode')).toBe(false);
  });
});

describe('fileIconBadgeColor', () => {
  it('paints a badge in the light half of the pair — it sits on white paper either way', () => {
    expect(fileIconBadgeColor('code')).toBe('#2877a8');
  });
});

describe('fileIconAspectRatio', () => {
  it('reports the page as portrait and an Office logo as landscape', () => {
    expect(fileIconAspectRatio('FileCode')).toBeLessThan(1);
    expect(fileIconAspectRatio('FileExcel')).toBeGreaterThan(1);
  });

  it('measures a category off the paper, not off the square it is drawn in', () => {
    expect(fileIconAspectRatio('FileCode')).toBeCloseTo(PAGE_ASPECT_RATIO, 5);
  });

  it('gives every category the same ratio — they are one sheet, differently badged', () => {
    expect(fileIconAspectRatio('FileAudio')).toBe(fileIconAspectRatio('FileDocument'));
  });
});

const TRANSFORM_SHAPE = /^translate\((-?[\d.]+) (-?[\d.]+)\) scale\(([\d.]+)\)$/;

describe('FILE_BADGE_TRANSFORM', () => {
  /** Read the transform back out, so the assertions are about geometry rather than spelling. */
  const parsed = () => {
    const match = TRANSFORM_SHAPE.exec(FILE_BADGE_TRANSFORM);
    if (!match) throw new Error(`unparseable transform: ${FILE_BADGE_TRANSFORM}`);
    const x = Number(match[1]);
    const y = Number(match[2]);
    const scale = Number(match[3]);
    return { apply: (px: number, py: number) => [x + scale * px, y + scale * py] as const, scale };
  };

  it('lands the centre of the badge canvas on the centre of the page', () => {
    const { apply } = parsed();
    const [x, y] = apply(FILE_BADGE_SHEET.x + FILE_BADGE_SHEET.width / 2, FILE_BADGE_SHEET.y + FILE_BADGE_SHEET.height / 2);
    // Tolerance 2: the transform is rounded to 4 places, which moves a point by
    // a few thousandths once scaled up.
    expect(x).toBeCloseTo(FILE_PAPER_SHEET.x + FILE_PAPER_SHEET.width / 2, 2);
    expect(y).toBeCloseTo(FILE_PAPER_SHEET.y + FILE_PAPER_SHEET.height / 2, 2);
  });

  it('sizes the badge canvas to the width of the page', () => {
    const { scale } = parsed();
    expect(FILE_BADGE_SHEET.width * scale).toBeCloseTo(FILE_PAPER_SHEET.width, 2);
  });

  it('scales both axes alike, so a badge is never squashed to fit', () => {
    // The two sheets differ slightly in proportion; the badge keeps its own.
    const { apply } = parsed();
    const [x0, y0] = apply(0, 0);
    const [x1, y1] = apply(100, 100);
    expect(x1 - x0).toBeCloseTo(y1 - y0, 6);
  });

  it('keeps the badge inside the page it is drawn on', () => {
    const { scale } = parsed();
    expect(FILE_BADGE_SHEET.height * scale).toBeLessThanOrEqual(FILE_PAPER_SHEET.height);
  });
});

describe('fileIconWidthForBox', () => {
  it('fills a portrait slot on width, leaving the page room to be as tall as it is', () => {
    // Taller than the page's width asks for, so the width is the limit.
    const box = [40, 80] as const;
    expect(fileIconWidthForBox(...box)).toBe(40);
    expect(40 / PAGE_ASPECT_RATIO).toBeLessThanOrEqual(80);
  });

  it('backs off the width when the slot runs out of height first', () => {
    // Wider than the page's height allows, so the height is the limit.
    const box = [120, 60] as const;
    const width = fileIconWidthForBox(...box);
    expect(width).toBe(Math.floor(60 * PAGE_ASPECT_RATIO));
    expect(width).toBeLessThan(120);
  });

  it('is blind to the file, so a grid of mixed types shares one width', () => {
    // The PDF is square and would fit a taller box, but taking it would break
    // rank with the page beside it.
    const box = [40, 40] as const;
    expect(fileIconWidthForBox(...box)).toBe(Math.floor(40 * PAGE_ASPECT_RATIO));
  });
});
