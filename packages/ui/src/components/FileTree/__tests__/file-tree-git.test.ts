import { describe, expect, it } from 'vitest';
import type { FileTreeGitStatusMap } from '../file-tree.types';
import { computeGitRollups, gitStatusPresentation, resolveGitStatus } from '../file-tree-git';

describe('gitStatusPresentation', () => {
  it('maps each code to a letter + theme token', () => {
    expect(gitStatusPresentation('A')).toEqual({ letter: 'A', token: 'success', label: 'Added' });
    expect(gitStatusPresentation('M')).toEqual({ letter: 'M', token: 'warning', label: 'Modified' });
    expect(gitStatusPresentation('R')).toEqual({ letter: 'R', token: 'warning', label: 'Renamed' });
    expect(gitStatusPresentation('D')).toEqual({ letter: 'D', token: 'danger', label: 'Deleted' });
    expect(gitStatusPresentation('U')).toEqual({ letter: 'U', token: 'info', label: 'Conflicted' });
  });
});

describe('computeGitRollups', () => {
  it('returns an empty map when no status is supplied', () => {
    expect(computeGitRollups(undefined).size).toBe(0);
  });

  it('keeps a file its own status and rolls it into every ancestor', () => {
    const map: FileTreeGitStatusMap = { 'src/components/Button.tsx': 'M' };
    const rolled = computeGitRollups(map);
    expect(rolled.get('src/components/Button.tsx')).toBe('M');
    expect(rolled.get('src/components/')).toBe('M');
    expect(rolled.get('src/')).toBe('M');
  });

  it('ignores null (clean/ignored) entries', () => {
    const map: FileTreeGitStatusMap = { 'src/a.ts': null, 'src/b.ts': 'A' };
    const rolled = computeGitRollups(map);
    expect(rolled.has('src/a.ts')).toBe(false);
    expect(rolled.get('src/b.ts')).toBe('A');
    expect(rolled.get('src/')).toBe('A');
  });

  it('resolves rollup precedence U > M/R > A > D', () => {
    const map: FileTreeGitStatusMap = { 'p/added.ts': 'A', 'p/deleted.ts': 'D' };
    // A (rank 2) beats D (rank 1).
    expect(computeGitRollups(map).get('p/')).toBe('A');

    const map2: FileTreeGitStatusMap = { 'p/modified.ts': 'M', 'p/added.ts': 'A' };
    // M (rank 3) beats A (rank 2).
    expect(computeGitRollups(map2).get('p/')).toBe('M');

    const map3: FileTreeGitStatusMap = { 'p/conflict.ts': 'U', 'p/modified.ts': 'M' };
    // U (rank 4) beats M (rank 3).
    expect(computeGitRollups(map3).get('p/')).toBe('U');
  });
});

describe('resolveGitStatus', () => {
  it('reads from the rollup map, defaulting to null', () => {
    const rolled = computeGitRollups({ 'src/a.ts': 'A' });
    expect(resolveGitStatus(rolled, 'src/a.ts')).toBe('A');
    expect(resolveGitStatus(rolled, 'src/')).toBe('A');
    expect(resolveGitStatus(rolled, 'nowhere.ts')).toBeNull();
  });
});
