import { describe, expect, it } from 'vitest';
import { computeDirection, resolveSection } from '../multi-step-menu.logic';

type Section = { path: string; title?: string; subsections?: Section[] };

const ABOUT: Section = { path: 'about' };
const APPEARANCE: Section = { path: 'appearance' };
const GENERAL: Section = { path: 'general', subsections: [ABOUT, APPEARANCE] };
const PRIVACY: Section = { path: 'privacy' };

/** A two-level tree: `general` has children `about`/`appearance`, `privacy` is a leaf. */
const SECTIONS: Section[] = [GENERAL, PRIVACY];

describe('resolveSection', () => {
  it('resolves a single path segment to the matching top-level section', () => {
    expect(resolveSection(SECTIONS, ['privacy'])).toBe(PRIVACY);
  });

  it('resolves a nested path to the deepest matching section', () => {
    expect(resolveSection(SECTIONS, ['general', 'about'])).toBe(ABOUT);
  });

  it('resolves the last segment even when siblings exist at the same level', () => {
    expect(resolveSection(SECTIONS, ['general', 'appearance'])).toBe(APPEARANCE);
  });

  it('returns null for an empty path (the root is the list, not a section)', () => {
    expect(resolveSection(SECTIONS, [])).toBeNull();
  });

  it('returns null when a top-level segment is missing', () => {
    expect(resolveSection(SECTIONS, ['notifications'])).toBeNull();
  });

  it('returns null when a nested segment is missing', () => {
    expect(resolveSection(SECTIONS, ['general', 'wallpaper'])).toBeNull();
  });

  it('returns null when the path is deeper than the tree', () => {
    expect(resolveSection(SECTIONS, ['general', 'about', 'extra'])).toBeNull();
  });

  it('does not match a prefix of a segment name', () => {
    expect(resolveSection(SECTIONS, ['gener'])).toBeNull();
  });
});

describe('computeDirection', () => {
  it('is forward when the next path is deeper', () => {
    expect(computeDirection(['general'], ['general', 'about'])).toBe('forward');
  });

  it('is backward when the next path is shallower', () => {
    expect(computeDirection(['general', 'about'], ['general'])).toBe('backward');
  });

  it('is forward when the next path is a sibling swap of the same length', () => {
    expect(computeDirection(['general', 'about'], ['general', 'appearance'])).toBe('forward');
  });

  it('is forward from the root into the first level', () => {
    expect(computeDirection([], ['general'])).toBe('forward');
  });
});
