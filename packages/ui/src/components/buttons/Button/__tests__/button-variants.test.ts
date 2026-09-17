import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { describe, expect, it } from 'vitest';
import {
  BUTTON_HOVER_CLASS,
  type ButtonVariant,
  buttonContainer,
  buttonLabel,
  FILLED_FILL_TOKEN,
  FILLED_RIPPLE_VARIANTS,
  variantIconColorToken,
} from '../button-variants';

// The button family's colour tables — the fill/border of the plate and the
// colour of the label — are authored once in button-variants.ts, and every
// sibling reads that table rather than copying a class. But the classes still
// reference `--color-*` tokens by name (`bg-primary`, `text-primary-foreground`,
// `border-danger`), and nothing at runtime reconciles a class against the token
// sheet. A token renamed in tokens.css silently orphans the variant that names
// it. Same contract as scripts/check-token-parity.mjs, for the variant tables
// (which that script does not read).

// Resolved from the vitest root (packages/ui) rather than import.meta.url — the
// jsdom environment doesn't hand this module a file: URL.
const css = readFileSync(resolve(process.cwd(), 'src/theme/tokens.css'), 'utf8');

/** Every `--color-<token>` name declared in the sheet. */
const DECLARED_COLORS = new Set([...css.matchAll(/--color-([a-z0-9-]+):/g)].map((m) => m[1]));

// Utilities a variant class may legitimately name that are not `--color-*`
// tokens: `transparent` is a Tailwind built-in, and the `text-xs/sm/base/lg`
// strings are the shared font-size ramp (LABEL_TEXT_CLASS), not colours.
const NON_COLOR_UTILITIES = new Set(['transparent', 'xs', 'sm', 'base', 'lg', 'icon']);

const ALL_VARIANTS: ButtonVariant[] = [
  'primary',
  'secondary',
  'accent',
  'neutral',
  'ghost',
  'outline',
  'danger',
  'success',
  'warning',
  'info',
  'outlineDanger',
  'ghostDanger',
];

/** Every colour token a resolved class string names via `bg-`, `text-` or `border-`. */
function colourTokens(classes: string): string[] {
  const tokens: string[] = [];
  for (const [, token] of classes.matchAll(/\b(?:bg|text|border)-([a-z0-9-]+)/g))
    if (token !== undefined && !NON_COLOR_UTILITIES.has(token)) tokens.push(token);
  return tokens;
}

describe('variant icon colour', () => {
  it.each([
    ['primary', 'primary-foreground'],
    ['secondary', 'secondary-foreground'],
    ['accent', 'accent-foreground'],
    ['danger', 'danger-foreground'],
    ['success', 'success-foreground'],
    ['warning', 'warning-foreground'],
    ['info', 'info-foreground'],
    ['outlineDanger', 'danger'],
    ['ghostDanger', 'danger'],
    // Everything unlisted (neutral, ghost, outline, and any future variant)
    // resolves to the plain foreground rather than silently defaulting wrong.
    ['neutral', 'foreground'],
    ['ghost', 'foreground'],
    ['outline', 'foreground'],
  ] as const)('%s resolves the glyph/spinner to %s', (variant, token) => {
    expect(variantIconColorToken(variant)).toBe(token);
  });
});

describe('button plate fill', () => {
  it.each([
    ['primary', 'bg-primary'],
    ['secondary', 'bg-secondary'],
    ['accent', 'bg-accent'],
    ['neutral', 'bg-surface-3'],
    ['ghost', 'bg-transparent hover:bg-surface-hover'],
    ['outline', 'hairline border-foreground bg-transparent'],
    ['danger', 'bg-danger'],
    ['success', 'bg-success'],
    ['warning', 'bg-warning'],
    ['info', 'bg-info'],
    ['outlineDanger', 'hairline border-danger bg-transparent'],
    ['ghostDanger', 'bg-transparent hover:bg-surface-hover'],
  ] as const)('%s paints the expected plate', (variant, plate) => {
    expect(buttonContainer({ variant })).toContain(plate);
  });

  it('always carries the shared flex centre base', () => {
    for (const variant of ALL_VARIANTS) expect(buttonContainer({ variant })).toContain('flex-row items-center justify-center');
  });

  it('shares one hover dim across the whole family', () => {
    expect(BUTTON_HOVER_CLASS).toContain('hover:opacity-80');
    for (const variant of ALL_VARIANTS) {
      // The hover class is applied at the render sites, but it must not collide
      // with the plate itself — it only adds opacity, never a fill or border.
      expect(buttonContainer({ variant })).not.toContain('hover:opacity');
    }
  });
});

describe('button label colour', () => {
  it.each([
    ['primary', 'text-primary-foreground'],
    ['secondary', 'text-secondary-foreground'],
    ['accent', 'text-accent-foreground'],
    ['neutral', 'text-foreground'],
    ['ghost', 'text-foreground'],
    ['outline', 'text-foreground'],
    ['danger', 'text-white'],
    ['success', 'text-success-foreground'],
    ['warning', 'text-warning-foreground'],
    ['info', 'text-info-foreground'],
    ['outlineDanger', 'text-danger'],
    ['ghostDanger', 'text-danger'],
  ] as const)('%s labels with the expected colour', (variant, colour) => {
    expect(buttonLabel({ variant })).toContain(colour);
  });

  it('carries the family size ramp on the label', () => {
    for (const variant of ALL_VARIANTS) {
      // The label's size axis is the shared LABEL_TEXT_CLASS ramp, so a button
      // and a neighbouring input/tab at the same size read the same label.
      expect(buttonLabel({ variant, size: 'sm' })).toContain('text-sm');
      expect(buttonLabel({ variant, size: 'lg' })).toContain('text-lg');
    }
  });
});

const byName = (a: string, b: string) => a.localeCompare(b);

describe('filled-variant bookkeeping stays in agreement', () => {
  it('ripple and fill-ring name exactly the filled variants', () => {
    expect([...FILLED_RIPPLE_VARIANTS].sort(byName)).toStrictEqual(['danger', 'info', 'primary', 'success', 'warning']);
    expect(Object.keys(FILLED_FILL_TOKEN).sort(byName)).toStrictEqual([...FILLED_RIPPLE_VARIANTS].sort(byName));
  });

  it('each filled variant maps to its own fill token', () => {
    expect(FILLED_FILL_TOKEN).toStrictEqual({
      primary: 'primary',
      danger: 'danger',
      success: 'success',
      warning: 'warning',
      info: 'info',
    });
  });
});

describe('colour classes stay pinned to the token sheet', () => {
  it('every class the variant tables name is a declared --color-* token', () => {
    // A class that names a token not in the sheet would compile to nothing and
    // silently paint the wrong (or no) colour. This is the drift this suite
    // exists to catch.
    const referenced = new Set<string>();
    for (const variant of ALL_VARIANTS) {
      for (const token of colourTokens(buttonContainer({ variant }))) referenced.add(token);
      for (const size of ['xs', 'sm', 'md', 'lg', 'icon'] as const)
        for (const token of colourTokens(buttonLabel({ variant, size }))) referenced.add(token);
    }
    const missing = [...referenced].filter((token) => !DECLARED_COLORS.has(token));
    expect(missing).toStrictEqual([]);
  });
});
