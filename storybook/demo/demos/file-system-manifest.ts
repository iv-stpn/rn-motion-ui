// The manifest the FileSystem tab browses, plus the pure rewrites its handlers
// apply. <FileSystem> never mutates `items` — a drop reports `onMove` and a menu
// pick reports `onContextMenuAction` — so the demo owns the list and these
// functions are what that consumer side looks like: plain rewrites over a flat
// path list, no tree to rebuild.
//
// Everything is declared first and exported in one block at the end, which is
// the order the repo's lint config asks for.

import type { FileSystemItem } from 'rn-motion-ui/file-system';

/**
 * Tiny (8–12 px) PNGs as data URIs, upscaled by the tiles into abstract
 * gradients. Inline so the previews render identically on web and native, with
 * nothing to fetch.
 */
const PREVIEWS = {
  dunes:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAICAIAAABChommAAAASUlEQVR42mP4dqqLIGJ4u78RK/r/7RqczfB0cwVW9P/btf/frkHYDHdW5GNFEEUQNsOVOakEEcPpiTEEEcPh1mCCiGFXlRdBBAAh9rlFlMxWWwAAAABJRU5ErkJggg==',
  forest:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAICAIAAABChommAAAAN0lEQVR42mPYc20FQcSw/PAMgohh0oZOgoihdm4lQcSQ2Z1JEDGEVEQSRAz2qV4EEYNWkBVBBABKR40B+0IKAQAAAABJRU5ErkJggg==',
  harbour:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAICAIAAABChommAAAASUlEQVR42mOYdeoFQcTQufMmVvT/2zU4m6FyxWms6P+3a/+/XYOwGTKm78GKIIogbIaI9nUEEYN72XyCiME8dSJBxKAW0kQQAQDXyaIPabO+EAAAAABJRU5ErkJggg==',
  page: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAMCAIAAADQ/GvKAAAAUUlEQVR42mN49+4DVsTw5MkLrIjh1u37WBHD+YvXsSKGo8fPY0UMu/cdw4oYNm7ZhxUxLF+9FStimLtwLVbEMGn6UqyIoaNvDlbEUNcyBSsCAJYN0mFYbm40AAAAAElFTkSuQmCC',
};

/** Landscape photo proportions; documents keep the default portrait page. */
const PHOTO_RATIO = 1.5;

/** Fixed timestamps keep the Date Modified column and the date sorts stable. */
const DATES = {
  april: '2026-04-02T11:20:00.000Z',
  february: '2026-02-14T16:05:00.000Z',
  january: '2026-01-08T09:30:00.000Z',
  june: '2026-06-21T08:15:00.000Z',
  march: '2026-03-19T14:45:00.000Z',
  may: '2026-05-11T17:40:00.000Z',
};

/** Long enough for the loading placeholder to be visible on a fast machine. */
const LOAD_DELAY_MS = 320;

/** Last path segment, without a folder's trailing slash. */
function baseName(path: string): string {
  const body = path.endsWith('/') ? path.slice(0, -1) : path;
  return body.slice(body.lastIndexOf('/') + 1);
}

/** Everything up to and including the last slash: the entry's parent prefix. */
function parentPrefix(path: string): string {
  const body = path.endsWith('/') ? path.slice(0, -1) : path;
  const cut = body.lastIndexOf('/');
  return cut === -1 ? '' : body.slice(0, cut + 1);
}

/** The root is the empty path; name it after the title the header shows. */
function folderLabel(path: string): string {
  return path === '' ? 'Files' : path;
}

const NEW_FOLDER_NAME = 'untitled folder';

// Only files are listed at the top level — `Documents/` and `Photos/` are
// inferred from their paths — while `Archive/` is declared with `hasChildren`
// and no entries, so it only fills in through `loadChildren`.
const ITEMS: FileSystemItem[] = [
  { hasChildren: true, kind: 'folder', path: 'Archive/', updatedAt: DATES.january },
  { createdAt: DATES.june, kind: 'file', path: 'README.md', pinnedAt: DATES.june, size: 2480, updatedAt: DATES.june },
  {
    createdAt: DATES.may,
    kind: 'file',
    favoritedAt: DATES.may,
    path: 'Invoice-0042.pdf',
    previewImageUrl: PREVIEWS.page,
    size: 84_120,
  },
  { createdAt: DATES.april, kind: 'file', path: 'Roadmap.pptx', pinnedAt: DATES.april, size: 1_204_000, updatedAt: DATES.may },
  { createdAt: DATES.march, kind: 'file', path: 'Budget-2026.xlsx', size: 96_400, updatedAt: DATES.june },
  {
    createdAt: DATES.january,
    kind: 'file',
    path: 'Documents/Contract.docx',
    pinnedAt: DATES.january,
    size: 48_900,
    updatedAt: DATES.february,
  },
  {
    createdAt: DATES.february,
    kind: 'file',
    favoritedAt: DATES.february,
    path: 'Documents/notes.txt',
    size: 1120,
    updatedAt: DATES.march,
  },
  {
    createdAt: DATES.january,
    kind: 'file',
    path: 'Documents/Reports/Q1-report.pdf',
    previewImageUrl: PREVIEWS.page,
    size: 320_500,
    updatedAt: DATES.april,
  },
  {
    createdAt: DATES.april,
    favoritedAt: DATES.april,
    kind: 'file',
    path: 'Documents/Reports/Q2-report.pdf',
    previewImageUrl: PREVIEWS.page,
    size: 298_100,
    updatedAt: DATES.june,
  },
  {
    createdAt: DATES.march,
    kind: 'file',
    path: 'Photos/dunes.jpg',
    pinnedAt: DATES.march,
    previewAspectRatio: PHOTO_RATIO,
    previewImageUrl: PREVIEWS.dunes,
    size: 2_140_000,
    updatedAt: DATES.march,
    url: PREVIEWS.dunes,
  },
  {
    createdAt: DATES.may,
    kind: 'file',
    path: 'Photos/harbour.jpg',
    previewAspectRatio: PHOTO_RATIO,
    previewImageUrl: PREVIEWS.harbour,
    size: 1_880_000,
    updatedAt: DATES.may,
    url: PREVIEWS.harbour,
  },
  {
    createdAt: DATES.june,
    favoritedAt: DATES.june,
    kind: 'file',
    path: 'Photos/forest.png',
    previewAspectRatio: PHOTO_RATIO,
    previewImageUrl: PREVIEWS.forest,
    size: 3_260_000,
    updatedAt: DATES.june,
    url: PREVIEWS.forest,
  },
];

/** What `Archive/` resolves to. Kept out of `ITEMS` so the load is observable. */
const ARCHIVE: FileSystemItem[] = [
  { createdAt: DATES.january, kind: 'file', path: 'Archive/2024-summary.pdf', previewImageUrl: PREVIEWS.page, size: 210_300 },
  { createdAt: DATES.january, kind: 'file', path: 'Archive/legacy.zip', size: 8_412_000 },
  { createdAt: DATES.january, kind: 'file', path: 'Archive/2024/minutes.docx', size: 22_600 },
];

/**
 * True for the entry itself and everything beneath it. Folder paths end in `/`,
 * so `startsWith` on a folder path can only match its own descendants.
 */
function isInSubtree(path: string, root: string): boolean {
  return path === root || path.startsWith(root);
}

/**
 * `path` rewritten to sit under `destination`. Folder paths keep their trailing
 * slash, so a prefix test is a subtree test: every descendant is rewritten by
 * swapping the same leading run of characters.
 */
function movePath(path: string, source: string, destination: string): string {
  const moved = destination + baseName(source) + (source.endsWith('/') ? '/' : '');
  return path === source ? moved : moved + path.slice(source.length);
}

/** ` copy` before the extension for files, `Name copy/` for folders. */
function copyName(path: string): string {
  if (path.endsWith('/')) return `${path.slice(0, -1)} copy/`;
  const dot = path.lastIndexOf('.');
  const cut = dot > path.lastIndexOf('/') ? dot : path.length;
  return `${path.slice(0, cut)} copy${path.slice(cut)}`;
}

/** The list after {@link applyNewFolder}, plus the path the folder settled on. */
type NewFolderResult = { items: FileSystemItem[]; path: string };

/** Apply a drop: the dragged entry and its whole subtree land under `destination`. */
function applyMove(items: FileSystemItem[], source: string, destination: string): FileSystemItem[] {
  return items.map((item) =>
    isInSubtree(item.path, source) ? { ...item, path: movePath(item.path, source, destination) } : item,
  );
}

/** Duplicate an entry, subtree included, beside the original. */
function applyDuplicate(items: FileSystemItem[], source: string): FileSystemItem[] {
  const target = copyName(source);
  const copies = items
    .filter((item) => isInSubtree(item.path, source))
    .map((item) => ({ ...item, path: target + item.path.slice(source.length) }));
  // An inferred folder has no entry of its own, so declare the copy explicitly.
  if (source.endsWith('/') && !copies.some((item) => item.path === target))
    copies.unshift({ kind: 'folder', path: target, updatedAt: DATES.june });
  return [...items, ...copies];
}

/** Drop an entry and everything beneath it. */
function applyDelete(items: FileSystemItem[], source: string): FileSystemItem[] {
  return items.filter((item) => !isInSubtree(item.path, source));
}

/** An `untitled folder` in `parent`, numbered until the name is free. */
function applyNewFolder(items: FileSystemItem[], parent: string): NewFolderResult {
  const taken = (candidate: string) => items.some((item) => isInSubtree(item.path, candidate));
  let path = `${parent}${NEW_FOLDER_NAME}/`;
  for (let n = 2; taken(path); n += 1) path = `${parent}${NEW_FOLDER_NAME} ${n}/`;
  return { items: [...items, { kind: 'folder', path, updatedAt: DATES.june }], path };
}

export {
  ARCHIVE as ARCHIVE_ITEMS,
  applyDelete,
  applyDuplicate,
  applyMove,
  applyNewFolder,
  baseName,
  folderLabel,
  ITEMS as SAMPLE_ITEMS,
  LOAD_DELAY_MS,
  parentPrefix,
};
