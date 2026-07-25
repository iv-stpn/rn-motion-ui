// Tap-to-select / tap-again-to-open, the native stand-in for the web version's
// click + double-click pair.

import { useCallback, useRef } from 'react';
import type { FileSystemEntry } from './file-system.types';

/** A second activation within this window opens instead of re-selecting. */
const DOUBLE_TAP_MS = 400;

/**
 * Row/tile activation: the first press selects, a second press on the same
 * entry within {@link DOUBLE_TAP_MS} opens it. Mouse double-clicks arrive as two
 * presses, so the same handler covers web without a separate path.
 */
export function useEntryActivation(
  onOpen: (entry: FileSystemEntry) => void,
  onSelect: (entry: FileSystemEntry | null) => void,
): (entry: FileSystemEntry) => void {
  const lastRef = useRef({ at: 0, path: '' });

  return useCallback(
    (entry: FileSystemEntry) => {
      const now = Date.now();
      const isRepeat = lastRef.current.path === entry.path && now - lastRef.current.at < DOUBLE_TAP_MS;
      lastRef.current = { at: now, path: entry.path };
      if (isRepeat) onOpen(entry);
      else onSelect(entry);
    },
    [onOpen, onSelect],
  );
}
