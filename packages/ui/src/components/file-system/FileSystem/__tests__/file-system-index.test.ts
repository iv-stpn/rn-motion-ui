import { describe, expect, it } from 'vitest';
import type { FileSystemItem } from '../file-system.types';
import { buildFileSystemIndex } from '../file-system-index';

/**
 * Re-index a manifest against the previous snapshot the store keeps — the same
 * two arguments `_setItems` hands `buildFileSystemIndex` when the consumer
 * rewrites `items` after a drop. `preserveFolders` keeps folders that lost their
 * last child; `previousChildren` is how a wholesale *move* is told apart from a
 * folder that was merely emptied in place.
 */
function rebuild(items: FileSystemItem[], previousItems: FileSystemItem[]) {
  const previous = buildFileSystemIndex(previousItems);
  return buildFileSystemIndex(items, {
    preserveFolders: previous.folders,
    previousChildren: previous.children,
  });
}

describe('buildFileSystemIndex folder preservation', () => {
  it('keeps an inferred folder whose last file was dragged out', () => {
    const index = rebuild([{ kind: 'file', path: 'notes.txt' }], [{ kind: 'file', path: 'Documents/notes.txt' }]);
    // The folder emptied, but it was not moved: an empty folder is still a folder.
    expect(index.folders.has('Documents/')).toBe(true);
  });

  it('does not leave a husk when a folder is moved into another folder', () => {
    const index = rebuild(
      [
        { kind: 'file', path: 'Archive/Documents/notes.txt' },
        { kind: 'file', path: 'Archive/Documents/Reports/Q1.pdf' },
      ],
      [
        { kind: 'file', path: 'Documents/notes.txt' },
        { kind: 'file', path: 'Documents/Reports/Q1.pdf' },
      ],
    );
    // The whole subtree reappeared under Archive/, so Documents/ must not linger.
    expect(index.folders.has('Documents/')).toBe(false);
    expect(index.folders.has('Documents/Reports/')).toBe(false);
    expect(index.folders.has('Archive/Documents/')).toBe(true);
    expect(index.folders.has('Archive/Documents/Reports/')).toBe(true);
  });

  it('moves an explicitly-declared folder and its subfolder without husks', () => {
    const index = rebuild(
      [
        { kind: 'folder', path: 'Archive/Documents/' },
        { kind: 'folder', path: 'Archive/Documents/Reports/' },
        { kind: 'file', path: 'Archive/Documents/Reports/Q1.pdf' },
      ],
      [
        { kind: 'folder', path: 'Documents/' },
        { kind: 'folder', path: 'Documents/Reports/' },
        { kind: 'file', path: 'Documents/Reports/Q1.pdf' },
      ],
    );
    expect(index.folders.has('Documents/')).toBe(false);
    expect(index.folders.has('Documents/Reports/')).toBe(false);
    expect(index.folders.has('Archive/Documents/')).toBe(true);
    expect(index.folders.has('Archive/Documents/Reports/')).toBe(true);
  });

  it('does not mistake a same-named sibling for the mover', () => {
    const index = rebuild(
      [
        { kind: 'file', path: 'notes.txt' },
        // A genuinely separate folder that happens to share the name — its
        // children differ, so it is not where Documents/ went.
        { kind: 'file', path: 'Archive/Documents/other.txt' },
      ],
      [{ kind: 'file', path: 'Documents/notes.txt' }],
    );
    expect(index.folders.has('Documents/')).toBe(true);
    expect(index.folders.has('Archive/Documents/')).toBe(true);
  });
});
