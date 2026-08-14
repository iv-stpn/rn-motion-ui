import { describe, expect, it } from 'vitest';
import { createDragTransfer } from '../../../gestures/drag-transfer';
import {
  acceptsFileSystemDrop,
  canDropFileSystemItem,
  type FileSystemDragItem,
  FS_DRAG_ITEMS_MIME,
  fileSystemDragData,
  fileSystemDragItems,
  fileSystemDragLabel,
  movableFileSystemSources,
  readFileSystemDragItems,
} from '../logic/file-system-drag';
import { buildFileSystemIndex } from '../logic/file-system-index';
import type { FileSystemItem } from '../types/file-system.types';

const TRAILING_SLASH = /\/$/;

/** A folder path always carries the trailing slash the index normalises to. */
function folder(path: string, parentPath = ''): FileSystemDragItem {
  return { kind: 'folder', name: path.replace(TRAILING_SLASH, '').split('/').pop() ?? '', parentPath, path };
}

function file(path: string, parentPath = ''): FileSystemDragItem {
  return { kind: 'file', name: path.split('/').pop() ?? '', parentPath, path };
}

const MANIFEST: FileSystemItem[] = [
  { kind: 'folder', path: 'Docs/' },
  { kind: 'folder', path: 'Docs/Q1/' },
  { kind: 'file', path: 'Docs/notes.txt' },
  { kind: 'file', path: 'photo.jpg' },
];

describe('canDropFileSystemItem', () => {
  it('refuses an entry onto itself', () => {
    expect(canDropFileSystemItem(folder('Docs/'), 'Docs/')).toBe(false);
  });

  it('refuses an entry into the folder it already sits in', () => {
    expect(canDropFileSystemItem(file('Docs/notes.txt', 'Docs/'), 'Docs/')).toBe(false);
  });

  it('refuses a folder into its own subtree, at any depth', () => {
    const docs = folder('Docs/');
    expect(canDropFileSystemItem(docs, 'Docs/Q1/')).toBe(false);
    expect(canDropFileSystemItem(docs, 'Docs/Q1/Drafts/')).toBe(false);
  });

  it('allows a folder into a sibling, and into the root it came from a level down', () => {
    expect(canDropFileSystemItem(folder('Docs/Q1/', 'Docs/'), 'Archive/')).toBe(true);
    expect(canDropFileSystemItem(folder('Docs/Q1/', 'Docs/'), '')).toBe(true);
  });

  it('allows a file anywhere but its own parent', () => {
    const notes = file('Docs/notes.txt', 'Docs/');
    expect(canDropFileSystemItem(notes, 'Docs/Q1/')).toBe(true);
    expect(canDropFileSystemItem(notes, '')).toBe(true);
  });

  it('treats a name-prefix sibling as a separate branch, not a subtree', () => {
    // 'Docs2/' starts with 'Docs' but not with 'Docs/', which is why the subtree
    // test compares against the trailing-slash form rather than the bare name.
    expect(canDropFileSystemItem(folder('Docs/'), 'Docs2/')).toBe(true);
  });
});

describe('movableFileSystemSources', () => {
  it('keeps the members a destination can take and drops the rest', () => {
    const items = [file('Docs/notes.txt', 'Docs/'), file('photo.jpg', ''), folder('Docs/Q1/', 'Docs/')];
    // 'Docs/' is already the parent of two of them; only the root-level file moves.
    expect(movableFileSystemSources(items, 'Docs/')).toEqual(['photo.jpg']);
  });

  it('returns paths in the order the group carried them', () => {
    const items = [file('b.txt'), file('a.txt')];
    expect(movableFileSystemSources(items, 'Docs/')).toEqual(['b.txt', 'a.txt']);
  });

  it('is empty when nothing can move, which is what suppresses the drop', () => {
    expect(movableFileSystemSources([file('Docs/notes.txt', 'Docs/')], 'Docs/')).toEqual([]);
    expect(movableFileSystemSources([], 'Docs/')).toEqual([]);
  });
});

describe('acceptsFileSystemDrop', () => {
  it('agrees with movableFileSystemSources on every group, so a folder cannot light up and then refuse', () => {
    const groups: FileSystemDragItem[][] = [
      [],
      [file('photo.jpg')],
      [file('Docs/notes.txt', 'Docs/')],
      [file('Docs/notes.txt', 'Docs/'), file('photo.jpg')],
      [folder('Docs/')],
    ];
    for (const group of groups)
      expect(acceptsFileSystemDrop(group, 'Docs/')).toBe(movableFileSystemSources(group, 'Docs/').length > 0);
  });

  it('accepts a mixed group on the strength of one movable member', () => {
    expect(acceptsFileSystemDrop([file('Docs/notes.txt', 'Docs/'), file('photo.jpg')], 'Docs/')).toBe(true);
  });
});

describe('fileSystemDragItems', () => {
  it('resolves both files and folders, in the order given', () => {
    const index = buildFileSystemIndex(MANIFEST);
    expect(fileSystemDragItems(index, ['photo.jpg', 'Docs/'])).toEqual([
      { kind: 'file', name: 'photo.jpg', parentPath: '', path: 'photo.jpg' },
      { kind: 'folder', name: 'Docs', parentPath: '', path: 'Docs/' },
    ]);
  });

  it('leaves out a path the index no longer holds', () => {
    const index = buildFileSystemIndex(MANIFEST);
    expect(fileSystemDragItems(index, ['photo.jpg', 'deleted.txt']).map((item) => item.path)).toEqual(['photo.jpg']);
  });
});

describe('fileSystemDragData / readFileSystemDragItems', () => {
  it('round-trips a group through a transfer', () => {
    const items = [file('photo.jpg'), folder('Docs/')];
    const transfer = createDragTransfer();
    const data = fileSystemDragData(items);
    for (const [mime, value] of Object.entries(data)) transfer.setData(mime, value);
    expect(readFileSystemDragItems(transfer)).toEqual(items);
  });

  it('carries the names as text/plain, one per line, for a listener outside the library', () => {
    expect(fileSystemDragData([file('photo.jpg'), file('Docs/notes.txt', 'Docs/')])['text/plain']).toBe('photo.jpg\nnotes.txt');
  });

  it('reads an empty group off anything that is not ours', () => {
    // Every one of these reaches `accepts` during an ordinary drag — an OS file
    // drag, another component's payload, a truncated string — so none may throw.
    expect(readFileSystemDragItems(null)).toEqual([]);
    expect(readFileSystemDragItems(undefined)).toEqual([]);
    expect(readFileSystemDragItems(createDragTransfer())).toEqual([]);

    const malformed = createDragTransfer();
    malformed.setData(FS_DRAG_ITEMS_MIME, '[{"kind":"fol');
    expect(readFileSystemDragItems(malformed)).toEqual([]);

    const notAnArray = createDragTransfer();
    notAnArray.setData(FS_DRAG_ITEMS_MIME, '{"kind":"folder"}');
    expect(readFileSystemDragItems(notAnArray)).toEqual([]);
  });

  it('keeps the well-formed members of a partly-bad payload', () => {
    const transfer = createDragTransfer();
    const good = file('photo.jpg');
    transfer.setData(
      FS_DRAG_ITEMS_MIME,
      JSON.stringify([good, { kind: 'directory', path: 'x' }, null, 'photo.jpg', { path: 'y' }]),
    );
    expect(readFileSystemDragItems(transfer)).toEqual([good]);
  });
});

describe('fileSystemDragLabel', () => {
  it('names a single entry and counts a group', () => {
    expect(fileSystemDragLabel([file('photo.jpg')])).toBe('photo.jpg');
    expect(fileSystemDragLabel([file('photo.jpg'), folder('Docs/')])).toBe('2 items');
  });

  it('reports an empty group as a count rather than an empty name', () => {
    expect(fileSystemDragLabel([])).toBe('0 items');
  });
});
