import { describe, expect, it } from 'vitest';
import {
  breakpointForWidth,
  breakpointWidth,
  defaultBreakpoints,
  isWidthAtLeast,
  resolveScale,
  scaleSignature,
} from '../breakpoints';

describe('breakpointForWidth', () => {
  it('resolves each tier at its own edge', () => {
    expect(breakpointForWidth(0)).toBe('base');
    expect(breakpointForWidth(639)).toBe('base');
    expect(breakpointForWidth(640)).toBe('sm');
    expect(breakpointForWidth(767)).toBe('sm');
    expect(breakpointForWidth(768)).toBe('md');
    expect(breakpointForWidth(1023)).toBe('md');
    expect(breakpointForWidth(1024)).toBe('lg');
    expect(breakpointForWidth(1280)).toBe('xl');
    expect(breakpointForWidth(1536)).toBe('2xl');
    expect(breakpointForWidth(4000)).toBe('2xl');
  });

  it('never returns undefined for a negative width', () => {
    expect(breakpointForWidth(-10)).toBe('base');
  });

  it('honours a partial override and leaves other edges alone', () => {
    expect(breakpointForWidth(700, { md: 680 })).toBe('md');
    expect(breakpointForWidth(700)).toBe('sm');
    // lg is untouched by the md override
    expect(breakpointForWidth(1024, { md: 680 })).toBe('lg');
  });

  it('resolves by width, not by name position, when an override reorders the scale', () => {
    // md pushed above lg. Resolution walks the *resolved* widths descending
    // (2xl 1536, xl 1280, md 1200, lg 1024, sm 640), so:
    expect(breakpointForWidth(1100, { md: 1200 })).toBe('lg'); // clears lg, not yet md
    expect(breakpointForWidth(1250, { md: 1200 })).toBe('md'); // clears md, not yet xl
    expect(breakpointForWidth(1300, { md: 1200 })).toBe('xl');
  });

  it('breaks a tie in favour of the wider default tier', () => {
    // sm collided with md's 768: the widest-first default order wins.
    expect(breakpointForWidth(768, { sm: 768 })).toBe('md');
  });
});

describe('resolveScale', () => {
  it('returns a copy of the defaults when no overrides are given', () => {
    const scale = resolveScale();
    expect(scale).toEqual(defaultBreakpoints);
    expect(scale).not.toBe(defaultBreakpoints);
  });

  it('pins base to 0 even if an override tries to move it', () => {
    expect(resolveScale({ base: 200 }).base).toBe(0);
  });
});

describe('breakpointWidth', () => {
  it('passes a raw pixel number through', () => {
    expect(breakpointWidth(900)).toBe(900);
    expect(breakpointWidth(900, { md: 680 })).toBe(900);
  });

  it('resolves a name against the active scale', () => {
    expect(breakpointWidth('md')).toBe(768);
    expect(breakpointWidth('md', { md: 680 })).toBe(680);
  });
});

describe('isWidthAtLeast', () => {
  it('is inclusive at the edge', () => {
    expect(isWidthAtLeast(768, 'md')).toBe(true);
    expect(isWidthAtLeast(767, 'md')).toBe(false);
  });

  it('accepts a raw pixel threshold', () => {
    expect(isWidthAtLeast(900, 880)).toBe(true);
    expect(isWidthAtLeast(870, 880)).toBe(false);
  });
});

describe('scaleSignature', () => {
  it('is empty for no overrides', () => {
    expect(scaleSignature()).toBe('');
  });

  it('is equal for two distinct objects with the same values', () => {
    expect(scaleSignature({ md: 700 })).toBe(scaleSignature({ md: 700 }));
  });

  it('differs when a value differs', () => {
    expect(scaleSignature({ md: 700 })).not.toBe(scaleSignature({ md: 701 }));
  });

  it('is insensitive to key order', () => {
    expect(scaleSignature({ md: 700, lg: 900 })).toBe(scaleSignature({ lg: 900, md: 700 }));
  });
});
