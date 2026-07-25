import { describe, expect, it } from 'vitest';
import {
  applyDropToPaths,
  buildDropOperations,
  isSelfOrDescendantDrop,
  normalizeDraggedPaths,
  resolveDraggedPathsForStart,
  resolveMoveDestinationPath,
} from '../file-tree-dnd';

describe('normalizeDraggedPaths', () => {
  it('drops descendants when an ancestor is also dragged', () => {
    expect(normalizeDraggedPaths(['src/', 'src/index.ts', 'other.ts'])).toEqual(['src/', 'other.ts']);
  });

  it('keeps unrelated siblings', () => {
    expect(normalizeDraggedPaths(['a.ts', 'b.ts'])).toEqual(['a.ts', 'b.ts']);
  });
});

describe('resolveDraggedPathsForStart', () => {
  it('moves the whole selection when the row is a selected member of a multi-selection', () => {
    expect(resolveDraggedPathsForStart('a.ts', new Set(['a.ts', 'b.ts']))).toEqual(['a.ts', 'b.ts']);
  });

  it('moves just the row when it is not part of the selection', () => {
    expect(resolveDraggedPathsForStart('c.ts', new Set(['a.ts', 'b.ts']))).toEqual(['c.ts']);
  });

  it('moves just the row for a single-item selection', () => {
    expect(resolveDraggedPathsForStart('a.ts', new Set(['a.ts']))).toEqual(['a.ts']);
  });
});

describe('resolveMoveDestinationPath', () => {
  it('maps null to the top level', () => {
    expect(resolveMoveDestinationPath(null)).toBe('');
  });

  it('targets the directory itself when dropping onto a directory', () => {
    expect(resolveMoveDestinationPath('src/')).toBe('src/');
  });

  it('targets the parent directory when dropping onto a file', () => {
    expect(resolveMoveDestinationPath('src/index.ts')).toBe('src/');
  });
});

describe('isSelfOrDescendantDrop', () => {
  it('is true when a dragged directory contains the destination', () => {
    expect(isSelfOrDescendantDrop(['src/'], 'src/nested/')).toBe(true);
    expect(isSelfOrDescendantDrop(['src/'], 'src/')).toBe(true);
  });

  it('is false for an unrelated destination', () => {
    expect(isSelfOrDescendantDrop(['src/'], 'dest/')).toBe(false);
  });
});

describe('buildDropOperations', () => {
  const paths = ['src/', 'src/a.ts', 'src/nested/', 'src/nested/deep.ts', 'dest/', 'dest/keep.ts'];

  it('moves a file into a target directory', () => {
    const result = buildDropOperations(paths, ['src/a.ts'], 'dest/');
    if (!result) throw new Error('buildDropOperations returned null unexpectedly');

    expect(result.destination).toBe('dest/');
    expect(result.operations).toEqual([{ from: 'src/a.ts', to: 'dest/a.ts' }]);
    expect(applyDropToPaths(paths, result.remap)).toContain('dest/a.ts');
  });

  it('moves a directory and remaps every descendant', () => {
    const result = buildDropOperations(paths, ['src/nested/'], 'dest/');
    if (!result) throw new Error('buildDropOperations returned null unexpectedly');

    expect(result.operations).toEqual([{ from: 'src/nested/', to: 'dest/nested/' }]);
    expect(result.remap.get('src/nested/deep.ts')).toBe('dest/nested/deep.ts');
    const applied = applyDropToPaths(paths, result.remap);
    expect(applied).toContain('dest/nested/');
    expect(applied).toContain('dest/nested/deep.ts');
  });

  it('returns null when dropping a directory into itself or a descendant', () => {
    expect(buildDropOperations(paths, ['src/'], 'src/nested/')).toBeNull();
    expect(buildDropOperations(paths, ['src/'], 'src/')).toBeNull();
  });

  it('returns null for a no-op move already in the destination', () => {
    expect(buildDropOperations(paths, ['dest/keep.ts'], 'dest/')).toBeNull();
  });
});
