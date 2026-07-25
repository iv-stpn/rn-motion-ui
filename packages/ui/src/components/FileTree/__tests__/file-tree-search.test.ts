import { describe, expect, it } from 'vitest';
import { matchesQuery, resolveSearch } from '../file-tree-search';

const PATHS = [
  'src/',
  'src/components/',
  'src/components/Button.tsx',
  'src/components/Icon.tsx',
  'src/utils/',
  'src/utils/format.ts',
  'README.md',
];

describe('matchesQuery', () => {
  it('matches on the leaf name case-insensitively', () => {
    expect(matchesQuery('src/components/Button.tsx', 'button')).toBe(true);
    expect(matchesQuery('src/components/Button.tsx', 'BUTTON')).toBe(true);
  });

  it('does not match on ancestor segments', () => {
    // "components" is in the path but not the leaf name of the file.
    expect(matchesQuery('src/components/Button.tsx', 'components')).toBe(false);
  });

  it('matches directory leaf names', () => {
    expect(matchesQuery('src/components/', 'compo')).toBe(true);
  });
});

describe('resolveSearch — empty query', () => {
  it('returns a clean resolution for blank/whitespace queries', () => {
    for (const q of ['', '   ']) {
      const res = resolveSearch(PATHS, q, 'hide-non-matches');
      expect(res.matches.size).toBe(0);
      expect(res.allowedPaths).toBeNull();
      expect(res.forceExpand.size).toBe(0);
    }
  });
});

describe('resolveSearch — expand-matches', () => {
  it('collects matches and force-expands their ancestors, no allowedPaths', () => {
    const res = resolveSearch(PATHS, 'button', 'expand-matches');
    expect(res.matches).toEqual(new Set(['src/components/Button.tsx']));
    expect(res.allowedPaths).toBeNull();
    expect(res.forceExpand).toEqual(new Set(['src/', 'src/components/']));
  });
});

describe('resolveSearch — collapse-non-matches', () => {
  it('behaves like expand-matches for the sets it returns (projection handles collapse)', () => {
    const res = resolveSearch(PATHS, 'format', 'collapse-non-matches');
    expect(res.matches).toEqual(new Set(['src/utils/format.ts']));
    expect(res.allowedPaths).toBeNull();
    expect(res.forceExpand).toEqual(new Set(['src/', 'src/utils/']));
  });
});

describe('resolveSearch — hide-non-matches', () => {
  it('allows matches plus ancestors', () => {
    const res = resolveSearch(PATHS, 'readme', 'hide-non-matches');
    expect(res.matches).toEqual(new Set(['README.md']));
    // README.md is top-level: no ancestors.
    expect(res.allowedPaths).toEqual(new Set(['README.md']));
  });

  it('includes descendants of a matched directory so it is not hollow', () => {
    const res = resolveSearch(PATHS, 'utils', 'hide-non-matches');
    expect(res.matches).toEqual(new Set(['src/utils/']));
    expect(res.allowedPaths).toEqual(new Set(['src/', 'src/utils/', 'src/utils/format.ts']));
  });

  it('combines file match ancestors with dir match descendants', () => {
    const res = resolveSearch(PATHS, 'components', 'hide-non-matches');
    // "components" only matches the directory leaf.
    expect(res.matches).toEqual(new Set(['src/components/']));
    expect(res.allowedPaths).toEqual(
      new Set(['src/', 'src/components/', 'src/components/Button.tsx', 'src/components/Icon.tsx']),
    );
  });
});
