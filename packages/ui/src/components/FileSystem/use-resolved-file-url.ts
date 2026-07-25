// Resolves a display URL for a file: its own `url`, else through `getFileUrl`.
// Keyed by path and url rather than object identity, so manifest churn (preview
// images streaming in) doesn't re-trigger a presign for the same file. The
// shared cache serves revisited files synchronously — no repeat round-trip and
// no loading flash when stepping back to a file the gallery already showed.

import { useEffect, useRef, useState } from 'react';
import type { FileEntry, FileSystemFileItem } from './file-system.types';

export type ResolvedFileUrl = { isResolving: boolean; url: string | null };

export function useResolvedFileUrl(
  file: FileEntry | null,
  getFileUrl?: (file: FileSystemFileItem) => string | Promise<string>,
  cache?: Map<string, string>,
): ResolvedFileUrl {
  const [state, setState] = useState<ResolvedFileUrl>(() => ({
    isResolving: false,
    url: file ? (file.url ?? cache?.get(file.path) ?? null) : null,
  }));

  // The latest file object, so the effect can hand the caller the current item
  // without re-running when only its metadata changed.
  const fileRef = useRef(file);
  fileRef.current = file;

  const filePath = file?.path ?? null;
  const fileUrl = file?.url ?? null;

  // biome-ignore lint/plugin: resolving a URL is I/O keyed on the shown file; there is no data library in this package to delegate it to
  useEffect(() => {
    const currentFile = fileRef.current;
    const knownUrl = fileUrl ?? (filePath ? (cache?.get(filePath) ?? null) : null);

    if (!currentFile || knownUrl || !getFileUrl) {
      setState({ isResolving: false, url: knownUrl });
      return;
    }

    let isCurrent = true;
    setState({ isResolving: true, url: null });

    Promise.resolve(getFileUrl(currentFile))
      .then((url) => {
        // Cache even when stale (selection moved on): the call is done, so let
        // the next visit reuse it.
        if (url) cache?.set(currentFile.path, url);
        if (isCurrent) setState({ isResolving: false, url });
      })
      // A failed resolve is not an error: the stage falls back to the thumbnail.
      .catch(() => {
        if (isCurrent) setState({ isResolving: false, url: null });
      });

    return () => {
      isCurrent = false;
    };
  }, [cache, filePath, fileUrl, getFileUrl]);

  return state;
}
