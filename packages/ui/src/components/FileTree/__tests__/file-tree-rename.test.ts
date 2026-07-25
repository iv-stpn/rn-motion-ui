import { describe, expect, it } from 'vitest';
import { isValidLeafName, remapPathSet, renameFileTreePaths } from '../file-tree-rename';

describe('isValidLeafName', () => {
  it('rejects empty, whitespace, and slash-bearing names', () => {
    expect(isValidLeafName('')).toBe(false);
    expect(isValidLeafName('   ')).toBe(false);
    expect(isValidLeafName('a/b')).toBe(false);
    expect(isValidLeafName('nested/')).toBe(false);
  });

  it('accepts a plain leaf name', () => {
    expect(isValidLeafName('index.ts')).toBe(true);
    expect(isValidLeafName('Component')).toBe(true);
  });
});

describe('renameFileTreePaths', () => {
  const paths = ['src/', 'src/index.ts', 'src/utils/', 'src/utils/math.ts', 'srcNote.md'];

  it('renames a single file without touching siblings', () => {
    const result = renameFileTreePaths(paths, 'src/index.ts', 'main.ts');
    if (!result) throw new Error('renameFileTreePaths returned null unexpectedly');

    expect(result.newPath).toBe('src/main.ts');
    expect(result.paths).toContain('src/main.ts');
    expect(result.paths).not.toContain('src/index.ts');
    expect(result.remap.size).toBe(1);
    expect(result.remap.get('src/index.ts')).toBe('src/main.ts');
  });

  it('renaming a directory rewrites the dir and every descendant, keeping the slash', () => {
    const result = renameFileTreePaths(paths, 'src/', 'lib');
    if (!result) throw new Error('renameFileTreePaths returned null unexpectedly');

    expect(result.newPath).toBe('lib/');
    expect(result.paths).toEqual(['lib/', 'lib/index.ts', 'lib/utils/', 'lib/utils/math.ts', 'srcNote.md']);
    // srcNote.md must NOT be rewritten despite the shared 'src' prefix.
    expect(result.remap.has('srcNote.md')).toBe(false);
  });

  it('returns null for an invalid or unchanged name', () => {
    expect(renameFileTreePaths(paths, 'src/index.ts', '')).toBeNull();
    expect(renameFileTreePaths(paths, 'src/index.ts', 'a/b')).toBeNull();
    expect(renameFileTreePaths(paths, 'src/index.ts', 'index.ts')).toBeNull();
    expect(renameFileTreePaths(paths, 'src/', 'src')).toBeNull();
  });
});

describe('remapPathSet', () => {
  it('carries a set through a rename remap, keeping unmoved entries', () => {
    const remap = new Map([
      ['src/', 'lib/'],
      ['src/index.ts', 'lib/index.ts'],
    ]);
    const next = remapPathSet(new Set(['src/', 'src/index.ts', 'other.ts']), remap);
    expect(next).toEqual(new Set(['lib/', 'lib/index.ts', 'other.ts']));
  });

  it('returns a copy when the remap is empty', () => {
    const original = new Set(['a', 'b']);
    const next = remapPathSet(original, new Map());
    expect(next).toEqual(original);
    expect(next).not.toBe(original);
  });
});
