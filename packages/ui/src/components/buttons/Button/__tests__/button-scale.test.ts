import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { describe, expect, it } from 'vitest';
import { INTERACTIVE_RADIUS } from '../../../../lib/radius';
import { SWITCHER_SCALE } from '../../../menus/MorphingSwitcher/morphing-switcher-scale';
import {
  BUTTON_BOX,
  BUTTON_ICON_SIZE,
  BUTTON_METRICS,
  BUTTON_SIZE,
  type ButtonShape,
  type ButtonSize,
  buttonRadius,
  type RampSize,
} from '../button-scale';

// The button family's geometry is authored once, in BUTTON_SIZE, and every
// interactive sibling reads that table: Button's label boxes (`box`), IconButton
// squares and the FAB trigger (`square`), and the MorphingSwitcher rows (`px`).
// But each geometry still exists in two forms — a class that compiles to an
// @theme token in tokens.css, and a pixel number (BUTTON_SIZE `px` /
// BUTTON_METRICS) for the effect layers that can't read a class — and nothing at
// runtime reconciles the two. A token edited in the stylesheet and missed in the
// table silently draws a rim on a different curve than the box it sits in. Same
// contract as scripts/check-token-parity.mjs, for the non-colour tokens.

// Resolved from the vitest root (packages/ui) rather than import.meta.url — the
// jsdom environment doesn't hand this module a file: URL.
const css = readFileSync(resolve(process.cwd(), 'src/theme/tokens.css'), 'utf8');

// Every geometry token in the sheet, by property name minus the leading `--`.
const DECLARED = new Map<string, number>();
for (const [, property = '', value = ''] of css.matchAll(
  /--((?:spacing|radius)-(?:interactive(?:-(?:pad-)?[a-z]+)?)):\s*(\d+(?:\.\d+)?)px;/g,
))
  DECLARED.set(property, Number(value));

/** The px value of a geometry token declared in tokens.css. */
function cssPx(property: string): number {
  const value = DECLARED.get(property);
  if (value === undefined) throw new Error(`--${property} is not declared as a px value in tokens.css`);
  return value;
}

// `icon` is the `md` box squared, so it names the same tokens rather than its own.
const TOKEN_SIZE: Record<ButtonSize, string> = { xs: 'xs', sm: 'sm', md: 'md', lg: 'lg', icon: 'md' };

describe('button geometry', () => {
  it.each(['xs', 'sm', 'md', 'lg', 'icon'] as const)('%s matches its tokens.css declaration', (size) => {
    const token = TOKEN_SIZE[size];
    expect(BUTTON_METRICS[size].height).toBe(cssPx(`spacing-interactive-${token}`));
    expect(BUTTON_METRICS[size].radius).toBe(INTERACTIVE_RADIUS);
    // An icon button is square: the box is the padding, so it declares none.
    expect(BUTTON_METRICS[size].padX).toBe(size === 'icon' ? 0 : cssPx(`spacing-interactive-pad-${token}`));
  });

  it('radius-interactive token matches the JS constant', () => {
    expect(INTERACTIVE_RADIUS).toBe(cssPx('radius-interactive'));
  });

  it.each(['xs', 'sm', 'md', 'lg', 'icon'] as const)('%s names the geometry tokens in its classes', (size) => {
    const token = TOKEN_SIZE[size];
    expect(BUTTON_BOX.rounded[size]).toContain(`h-interactive-${token}`);
    expect(BUTTON_BOX.rounded[size]).toContain('rounded-interactive');
    expect(BUTTON_BOX.pill[size]).toContain(`h-interactive-${token}`);
    expect(BUTTON_BOX.pill[size]).toContain('rounded-full');
    // Icon buttons are square — the box IS the padding, so no pad class.
    if (size !== 'icon') {
      expect(BUTTON_BOX.rounded[size]).toContain(`px-interactive-pad-${token}`);
      expect(BUTTON_BOX.pill[size]).toContain(`px-interactive-pad-${token}`);
    }
  });

  it('square and circle box shapes force a 1:1 box and drop horizontal padding', () => {
    // A label box in the `square` or `circle` shape hugs its content by padding,
    // which would let a long label stretch it into a pill/rectangle. Both force
    // the width to the ramp height instead, so overflow clips to the box.
    for (const size of ['xs', 'sm', 'md', 'lg'] as const) {
      expect(BUTTON_BOX.square[size]).toContain(`h-interactive-${size}`);
      expect(BUTTON_BOX.square[size]).toContain(`w-interactive-${size}`);
      expect(BUTTON_BOX.square[size]).toContain('rounded-interactive');
      expect(BUTTON_BOX.square[size]).not.toContain('px-interactive-pad');

      expect(BUTTON_BOX.circle[size]).toContain(`h-interactive-${size}`);
      expect(BUTTON_BOX.circle[size]).toContain(`w-interactive-${size}`);
      expect(BUTTON_BOX.circle[size]).toContain('rounded-full');
      expect(BUTTON_BOX.circle[size]).not.toContain('px-interactive-pad');
    }
  });

  it('resolves each shape to its corner radius', () => {
    for (const size of ['xs', 'sm', 'md', 'lg', 'icon'] as const) {
      expect(buttonRadius('square', size)).toBe(INTERACTIVE_RADIUS);
      expect(buttonRadius('rounded', size)).toBe(INTERACTIVE_RADIUS);
      expect(buttonRadius('pill', size)).toBe(BUTTON_METRICS[size].height / 2);
      expect(buttonRadius('circle', size)).toBe(BUTTON_METRICS[size].height / 2);
    }
  });

  it('mirrors every geometry token the sheet declares', () => {
    // The other direction: a token added to tokens.css that no size names is
    // either dead or a size the table forgot.
    const named = new Set<string>();
    for (const size of ['xs', 'sm', 'md', 'lg'] as const) {
      named.add(`spacing-interactive-${size}`);
      named.add(`spacing-interactive-pad-${size}`);
    }
    named.add('radius-interactive');
    const byName = (a: string, b: string) => a.localeCompare(b);
    expect([...DECLARED.keys()].sort(byName)).toStrictEqual([...named].sort(byName));
  });

  it('keeps every size on one box, so mixed button types line up', () => {
    // `icon` shares the md height (it's the md box squared), so the ramp is 4 wide.
    const heights = (['xs', 'sm', 'md', 'lg'] as const).map((size) => BUTTON_METRICS[size].height);
    expect(heights).toStrictEqual([...heights].sort((a, b) => a - b));
    expect(BUTTON_METRICS.icon.height).toBe(BUTTON_METRICS.md.height);
    expect(BUTTON_METRICS.icon.radius).toBe(INTERACTIVE_RADIUS);
  });
});

// The button family's icon-carrying siblings must stand at Button's per-size box,
// so a row of mixed controls lines up: IconButton's squares, the MorphingFAB's
// collapsed trigger and the MorphingSwitcher's rows all resolve to the shared
// `--spacing-interactive-*` ramp. They now do so by construction — each one reads
// BUTTON_SIZE rather than copying a number into its own scale file — so the guard
// pins that table to the tokens (and to the derived BUTTON_BOX / BUTTON_METRICS
// views), plus the one sibling that still authors its own row strings.

describe('shared geometry — IconButton, MorphingFAB and MorphingSwitcher read BUTTON_SIZE', () => {
  const sizes: RampSize[] = ['xs', 'sm', 'md', 'lg'];
  const shapes: ButtonShape[] = ['square', 'rounded', 'pill', 'circle'];
  const RADIUS_CLASS: Record<ButtonShape, string> = {
    square: 'rounded-interactive',
    rounded: 'rounded-interactive',
    pill: 'rounded-full',
    circle: 'rounded-full',
  };

  it.each(sizes)('the %s px twin sits on its tokens.css declaration', (size) => {
    expect(BUTTON_SIZE[size].px).toBe(cssPx(`spacing-interactive-${size}`));
    expect(BUTTON_SIZE[size].px).toBe(BUTTON_METRICS[size].height);
  });

  it.each(sizes)('the %s box stays the table entry every sibling indexes', (size) => {
    for (const shape of shapes) expect(BUTTON_BOX[shape][size]).toBe(BUTTON_SIZE[size].box[shape]);
  });

  it.each(sizes)('the %s square is the shared box squared', (size) => {
    // The square's width class names the same interactive token as its height, so
    // the side is the ramp height the same-size Button box uses — never a token of
    // its own that could drift off the ramp.
    for (const shape of shapes) {
      const square = BUTTON_SIZE[size].square[shape];
      expect(square).toContain(`h-interactive-${size}`);
      expect(square).toContain(`w-interactive-${size}`);
      expect(square).toContain(RADIUS_CLASS[shape]);
      // A square takes no horizontal padding — the box is the padding.
      expect(square).not.toContain('px-interactive-pad');
    }
  });

  it("Button's `icon` box is the table's `md` square, in every shape", () => {
    // IconButton supersedes `<Button size="icon">` (the md box squared), so the md
    // square and Button's icon square must be the same box literally — one class
    // string — or an icon-only swap in a row changes footprint.
    for (const shape of shapes) expect(BUTTON_BOX[shape].icon).toBe(BUTTON_SIZE.md.square[shape]);
  });

  it('the MorphingFAB collapses to the `lg` px', () => {
    // The FAB's collapsed trigger is an `lg` IconButton and its shell reads
    // BUTTON_SIZE.lg.px directly (no per-FAB constant remains), so pinning the `lg`
    // px to the token is what keeps the resting circle exactly the size of the
    // button inside it.
    expect(BUTTON_SIZE.lg.px).toBe(cssPx('spacing-interactive-lg'));
  });

  it.each(['sm', 'md', 'lg'] as const)('MorphingSwitcher %s rows stand at the shared %s px', (size) => {
    // The numeric height (which drives the pane arithmetic) is read from the same
    // table as the row's height class names, and the row's own class still names
    // the shared token. Only the row's horizontal inset is switcher-owned, so that
    // is what `rowClassName` carries beyond the token.
    expect(SWITCHER_SCALE[size].height).toBe(BUTTON_SIZE[size].px);
    expect(SWITCHER_SCALE[size].rowClassName).toContain(`h-interactive-${size}`);
    expect(SWITCHER_SCALE[size].rowClassName).toContain('py-0');
  });
});

describe('shared adornment icon ramp', () => {
  it('grows monotonically so an icon scales with its box', () => {
    const ramp = (['xs', 'sm', 'md', 'lg'] as const).map((size) => BUTTON_ICON_SIZE[size]);
    expect(ramp).toStrictEqual([...ramp].sort((a, b) => a - b));
  });

  it('`icon` shares `md`, since it is the `md` box squared', () => {
    expect(BUTTON_ICON_SIZE.icon).toBe(BUTTON_ICON_SIZE.md);
  });

  it.each(['xs', 'sm', 'md', 'lg', 'icon'] as const)('%s adornment icon fits inside its box height', (size) => {
    // A leading/trailing glyph must stay smaller than the box it sits in or the
    // button's `overflow-hidden` clips it. This is the guard against the ramp
    // drifting up past the interactive-height tokens.
    expect(BUTTON_ICON_SIZE[size]).toBeLessThan(BUTTON_METRICS[size].height);
  });
});
