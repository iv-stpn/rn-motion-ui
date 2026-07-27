import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { describe, expect, it } from 'vitest';
import { BUTTON_BOX, BUTTON_METRICS, type ButtonSize, buttonRadius } from '../button-scale';

// The button family's geometry is declared twice: as `@theme` tokens in
// tokens.css (which is what the classes in BUTTON_BOX compile to) and as pixel
// numbers in BUTTON_METRICS (which is what the effect layers that can't read a
// class use — GlossyButton's shadow slots, ElevatedButton's SVG rim). Nothing at
// runtime reconciles the two, so a token edited in the stylesheet and missed in
// the table silently draws a rim on a different curve than the box it sits in.
// Same contract as scripts/check-token-parity.mjs, for the non-colour tokens.

// Resolved from the vitest root (packages/ui) rather than import.meta.url — the
// jsdom environment doesn't hand this module a file: URL.
const css = readFileSync(resolve(process.cwd(), 'src/theme/tokens.css'), 'utf8');

// Every geometry token in the sheet, by property name minus the leading `--`.
const DECLARED = new Map<string, number>();
for (const [, property = '', value = ''] of css.matchAll(/--((?:spacing|radius)-button-[a-z-]+):\s*(\d+(?:\.\d+)?)px;/g))
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
    expect(BUTTON_METRICS[size].height).toBe(cssPx(`spacing-button-${token}`));
    expect(BUTTON_METRICS[size].radius).toBe(cssPx(`radius-button-${token}`));
    // An icon button is square: the box is the padding, so it declares none.
    expect(BUTTON_METRICS[size].padX).toBe(size === 'icon' ? 0 : cssPx(`spacing-button-pad-${token}`));
  });

  it.each(['sm', 'md', 'lg', 'icon'] as const)('%s names the geometry tokens in its classes', (size) => {
    const token = TOKEN_SIZE[size];
    expect(BUTTON_BOX.rounded[size]).toContain(`h-button-${token}`);
    expect(BUTTON_BOX.rounded[size]).toContain(`rounded-button-${token}`);
    expect(BUTTON_BOX.pill[size]).toContain(`h-button-${token}`);
    expect(BUTTON_BOX.pill[size]).toContain('rounded-full');
  });

  it('rounds a pill to half its height and everything else to its size radius', () => {
    for (const size of ['sm', 'md', 'lg', 'icon'] as const) {
      expect(buttonRadius('pill', size)).toBe(BUTTON_METRICS[size].height / 2);
      expect(buttonRadius('rounded', size)).toBe(BUTTON_METRICS[size].radius);
    }
  });

  it('mirrors every geometry token the sheet declares', () => {
    // The other direction: a token added to tokens.css that no size names is
    // either dead or a size the table forgot.
    const named = new Set<string>();
    for (const size of ['sm', 'md', 'lg'] as const) {
      named.add(`spacing-button-${size}`);
      named.add(`spacing-button-pad-${size}`);
      named.add(`radius-button-${size}`);
    }
    const byName = (a: string, b: string) => a.localeCompare(b);
    expect([...DECLARED.keys()].sort(byName)).toStrictEqual([...named].sort(byName));
  });

  it('keeps every size on one box, so mixed button types line up', () => {
    // `icon` shares the md height (it's the md box squared), so the ramp is 3 wide.
    const heights = (['sm', 'md', 'lg'] as const).map((size) => BUTTON_METRICS[size].height);
    expect(heights).toStrictEqual([...heights].sort((a, b) => a - b));
    expect(BUTTON_METRICS.icon.height).toBe(BUTTON_METRICS.md.height);
    expect(BUTTON_METRICS.icon.radius).toBe(BUTTON_METRICS.md.radius);
  });
});
