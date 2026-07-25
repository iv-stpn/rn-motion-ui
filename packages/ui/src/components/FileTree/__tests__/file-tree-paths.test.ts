import { describe, expect, it } from 'vitest';
import {
  ancestorPaths,
  canonicalizePath,
  compareNames,
  comparePaths,
  isDirectoryPath,
  isSelfOrDescendant,
  kindOfPath,
  leafName,
  parentPath,
  pathSegments,
} from '../file-tree-paths';

describe('canonicalizePath', () => {
  it('collapses slashes and strips the leading slash', () => {
    expect(canonicalizePath('/a//b/c.ts')).toBe('a/b/c.ts');
    expect(canonicalizePath('a/b/')).toBe('a/b/');
    expect(canonicalizePath('/src/')).toBe('src/');
  });
  it('returns empty for root-only inputs', () => {
    expect(canonicalizePath('')).toBe('');
    expect(canonicalizePath('/')).toBe('');
    expect(canonicalizePath('///')).toBe('');
  });
});

describe('kind + directory detection', () => {
  it('reads kind from the trailing slash', () => {
    expect(isDirectoryPath('a/b/')).toBe(true);
    expect(isDirectoryPath('a/b.ts')).toBe(false);
    expect(kindOfPath('a/')).toBe('directory');
    expect(kindOfPath('a.ts')).toBe('file');
  });
});

describe('leafName / parentPath', () => {
  it('extracts the leaf for files and dirs', () => {
    expect(leafName('a/b/c.ts')).toBe('c.ts');
    expect(leafName('a/b/')).toBe('b');
    expect(leafName('top.ts')).toBe('top.ts');
  });
  it('returns the parent dir or empty root', () => {
    expect(parentPath('a/b/c.ts')).toBe('a/b/');
    expect(parentPath('a/b/')).toBe('a/');
    expect(parentPath('top.ts')).toBe('');
    expect(parentPath('top/')).toBe('');
  });
});

describe('ancestorPaths / pathSegments', () => {
  it('lists ancestors root-first excluding self', () => {
    expect(ancestorPaths('a/b/c.ts')).toEqual(['a/', 'a/b/']);
    expect(ancestorPaths('a/b/')).toEqual(['a/']);
    expect(ancestorPaths('top.ts')).toEqual([]);
  });
  it('splits into segments', () => {
    expect(pathSegments('a/b/c.ts')).toEqual(['a', 'b', 'c.ts']);
    expect(pathSegments('a/b/')).toEqual(['a', 'b']);
  });
});

describe('isSelfOrDescendant', () => {
  it('matches self and nested paths under a directory', () => {
    expect(isSelfOrDescendant('a/', 'a/')).toBe(true);
    expect(isSelfOrDescendant('a/b/c.ts', 'a/')).toBe(true);
    expect(isSelfOrDescendant('a/b/', 'a/')).toBe(true);
    expect(isSelfOrDescendant('ab/c.ts', 'a/')).toBe(false);
    // A file is never an ancestor of anything but itself.
    expect(isSelfOrDescendant('a/b.ts', 'a/b.ts')).toBe(true);
    expect(isSelfOrDescendant('a/b.ts/c', 'a/b.ts')).toBe(false);
  });
});

describe('compareNames — natural order, case-insensitive', () => {
  it('orders numeric chunks numerically', () => {
    expect(compareNames('file2', 'file10')).toBeLessThan(0);
    expect(compareNames('file10', 'file2')).toBeGreaterThan(0);
  });
  it('is case-insensitive with a stable tiebreak', () => {
    expect(compareNames('Apple', 'banana')).toBeLessThan(0);
    expect(compareNames('a', 'A')).toBeGreaterThan(0); // lowercase after uppercase on raw tiebreak
  });
});

describe('comparePaths — dirs before files, then natural order', () => {
  it('sorts directories before files at the same level', () => {
    expect(comparePaths('src/', 'app.ts')).toBeLessThan(0);
    expect(comparePaths('readme.md', 'src/')).toBeGreaterThan(0);
  });
  it('orders siblings naturally', () => {
    const sorted = ['a/', 'b/', 'file1.ts', 'file2.ts', 'file10.ts'];
    const shuffled = ['file10.ts', 'b/', 'file2.ts', 'a/', 'file1.ts'];
    expect([...shuffled].sort(comparePaths)).toEqual(sorted);
  });
});
