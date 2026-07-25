/** biome-ignore-all lint/style/useExportsLast: the hook + its arg/return types read best together */
// Opening a file: resolve its URL (once, into the shared cache), then hand it to
// the consumer's `onFileOpen` or to the built-in viewer modal.
//
// A file the built-in viewer has no layout for is reported through `onFileOpen`
// when provided and otherwise ignored, since RN has no `window.open` to fall
// back to the way the web original did.

import { useCallback, useState } from 'react';
import type { FileEntry, FileSystemFileItem, FileSystemViewerArgs } from './file-system.types';
import { viewerKindForFile } from './file-system-kinds';
import type { FileSystemOpenedFile } from './file-system-viewer-modal';

export type UseFileOpenArgs = {
  urlCache: Map<string, string>;
  getFileUrl?: (file: FileSystemFileItem) => string | Promise<string>;
  onFileOpen?: (file: FileSystemFileItem, url: string | null) => void;
  /** Set when the consumer can show non-image kinds; without it only images open in the modal. */
  renderFileViewer?: (args: FileSystemViewerArgs) => unknown;
};

export type FileOpenState = { closeFile: () => void; openFile: (file: FileEntry) => void; opened: FileSystemOpenedFile | null };

/** The file's own URL, else the cache, else one presign — failures resolve to null. */
async function resolveOpenUrl(
  file: FileEntry,
  urlCache: Map<string, string>,
  getFileUrl: UseFileOpenArgs['getFileUrl'],
): Promise<string | null> {
  const known = file.url ?? urlCache.get(file.path) ?? null;
  if (known || !getFileUrl) return known;
  try {
    const url = await getFileUrl(file);
    if (url) urlCache.set(file.path, url);
    return url ?? null;
  } catch {
    // The stage falls back to the thumbnail, so a failed resolve is not an error.
    return null;
  }
}

export function useFileOpen(args: UseFileOpenArgs): FileOpenState {
  const { getFileUrl, onFileOpen, renderFileViewer, urlCache } = args;
  const [opened, setOpened] = useState<FileSystemOpenedFile | null>(null);
  const closeFile = useCallback(() => setOpened(null), []);

  const openFile = useCallback(
    (file: FileEntry) => {
      const kind = viewerKindForFile(file);
      // Images are built in; every other kind needs the consumer's viewer, so
      // without one the open is theirs to handle through `onFileOpen`.
      const isViewable = kind === 'image' || (kind !== null && Boolean(renderFileViewer));

      const show = async () => {
        const url = await resolveOpenUrl(file, urlCache, getFileUrl);
        if (onFileOpen) onFileOpen(file, url);
        else if (kind && isViewable) setOpened({ file, kind, url });
      };
      show().catch(() => undefined);
    },
    [getFileUrl, onFileOpen, renderFileViewer, urlCache],
  );

  return { closeFile, openFile, opened };
}
