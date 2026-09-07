import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { describe, expect, it } from 'vitest';
import { INTERACTIVE_RADIUS } from '../../../../lib/radius';
import { TRIGGER_RADIUS, TRIGGER_SIZE } from '../../../menus/MorphingFAB/morphing-fab-scale';
import { SWITCHER_SCALE } from '../../../menus/MorphingSwitcher/morphing-switcher-scale';
import { ICON_BUTTON_BOX, ICON_BUTTON_LG_SIZE } from '../../IconButton/icon-button-scale';
import { BUTTON_BOX, BUTTON_METRICS, type ButtonSize, buttonRadius } from '../button-scale';

// The button family's geometry is declared twice: as `@theme` tokens in
// tokens.css (which is what the classes in BUTTON_BOX compile to) and as pixel
// numbers in BUTTON_METRICS (which is what the effect layers that can't read a
// class use — ElevatedButton's SVG rim). Nothing at runtime reconciles the two,
// so a token edited in the stylesheet and missed in
// the table silently draws a rim on a different curve than the box it sits in.
// Same contract as scripts/check-token-parity.mjs, for the non-colour tokens.

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
const TOKEN_SIZE: Record<ButtonSize, string> = { sm: 'sm', md: 'md', lg: 'lg', icon: 'md' };

describe('button geometry', () => {
  it.each(['sm', 'md', 'lg', 'icon'] as const)('%s matches its tokens.css declaration', (size) => {
    const token = TOKEN_SIZE[size];
    expect(BUTTON_METRICS[size].height).toBe(cssPx(`spacing-interactive-${token}`));
    expect(BUTTON_METRICS[size].radius).toBe(INTERACTIVE_RADIUS);
    // An icon button is square: the box is the padding, so it declares none.
    expect(BUTTON_METRICS[size].padX).toBe(size === 'icon' ? 0 : cssPx(`spacing-interactive-pad-${token}`));
  });

  it('radius-interactive token matches the JS constant', () => {
    expect(INTERACTIVE_RADIUS).toBe(cssPx('radius-interactive'));
  });

  it.each(['sm', 'md', 'lg', 'icon'] as const)('%s names the geometry tokens in its classes', (size) => {
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

  it('rounds a pill to half its height and everything else to the interactive radius', () => {
    for (const size of ['sm', 'md', 'lg', 'icon'] as const) {
      expect(buttonRadius('pill', size)).toBe(BUTTON_METRICS[size].height / 2);
      expect(buttonRadius('rounded', size)).toBe(INTERACTIVE_RADIUS);
    }
  });

  it('mirrors every geometry token the sheet declares', () => {
    // The other direction: a token added to tokens.css that no size names is
    // either dead or a size the table forgot.
    const named = new Set<string>();
    for (const size of ['sm', 'md', 'lg'] as const) {
      named.add(`spacing-interactive-${size}`);
      named.add(`spacing-interactive-pad-${size}`);
    }
    named.add('radius-interactive');
    const byName = (a: string, b: string) => a.localeCompare(b);
    expect([...DECLARED.keys()].sort(byName)).toStrictEqual([...named].sort(byName));
  });

  it('keeps every size on one box, so mixed button types line up', () => {
    // `icon` shares the md height (it's the md box squared), so the ramp is 3 wide.
    const heights = (['sm', 'md', 'lg'] as const).map((size) => BUTTON_METRICS[size].height);
    expect(heights).toStrictEqual([...heights].sort((a, b) => a - b));
    expect(BUTTON_METRICS.icon.height).toBe(BUTTON_METRICS.md.height);
    expect(BUTTON_METRICS.icon.radius).toBe(INTERACTIVE_RADIUS);
  });
});

// The button family's icon-carrying siblings must stand at Button's per-size box,
// so a row of mixed controls lines up: IconButton's squares, the MorphingFAB's
// collapsed trigger and the MorphingSwitcher's rows all resolve to the shared
// `--spacing-interactive-*` ramp. Each author's geometry twice — a class that
// compiles to the tokens above and a JS pixel twin for the layers that can't read
// a class — and nothing at runtime reconciles the two, so a token retuned and a
// sibling's number missed silently mis-sizes that one control. Same dual-
// declaration contract as the Button tables above, for the siblings that copy them.

describe('interactive-family parity — IconButton, MorphingFAB, MorphingSwitcher vs Button', () => {
  const sizes = ['sm', 'md', 'lg'] as const;
  const shapes = ['rounded', 'pill'] as const;

  it.each(sizes)('IconButton %s is a square on the Button %s ramp', (size) => {
    // The square's width class names the same interactive token as its height, so
    // the side is the ramp height the same-size Button box uses — never a token of
    // its own that could drift off the ramp.
    for (const shape of shapes) {
      const box = ICON_BUTTON_BOX[shape][size];
      expect(box).toContain(`h-interactive-${size}`);
      expect(box).toContain(`w-interactive-${size}`);
      expect(box).toContain(shape === 'pill' ? 'rounded-full' : 'rounded-interactive');
    }
    expect(BUTTON_METRICS[size].height).toBe(cssPx(`spacing-interactive-${size}`));
  });

  it("IconButton `md` is Button's `icon` box, in both shapes", () => {
    // IconButton supersedes `<Button size="icon">` (the md box squared), so the md
    // square and Button's icon square must be the same box literally — one class
    // string — or an icon-only swap in a row changes footprint.
    for (const shape of shapes) expect(ICON_BUTTON_BOX[shape].md).toBe(BUTTON_BOX[shape].icon);
  });

  it("the icon-box pixel twin mirrors Button's lg height", () => {
    // The MorphingFAB collapses to this number (via its trigger), so a drift from
    // the ramp would leave the FAB's shell a different size than the lg IconButton
    // that fills it.
    expect(ICON_BUTTON_LG_SIZE).toBe(BUTTON_METRICS.lg.height);
    expect(ICON_BUTTON_LG_SIZE).toBe(cssPx('spacing-interactive-lg'));
  });

  it('MorphingFAB collapses to a Button lg circle', () => {
    expect(TRIGGER_SIZE).toBe(ICON_BUTTON_LG_SIZE);
    expect(TRIGGER_SIZE).toBe(BUTTON_METRICS.lg.height);
    expect(TRIGGER_RADIUS).toBe(TRIGGER_SIZE / 2);
  });

  it.each(sizes)('MorphingSwitcher %s rows stand at the Button %s height', (size) => {
    // The numeric height drives the pane arithmetic (row stacking, morph start);
    // the row class names the same token. Both must track the ramp or the open
    // pane stops matching the closed trigger and a Button next to it.
    expect(SWITCHER_SCALE[size].height).toBe(cssPx(`spacing-interactive-${size}`));
    expect(SWITCHER_SCALE[size].height).toBe(BUTTON_METRICS[size].height);
    expect(SWITCHER_SCALE[size].rowClassName).toContain(`h-interactive-${size}`);
    expect(SWITCHER_SCALE[size].rowClassName).toContain('py-0');
  });
});
