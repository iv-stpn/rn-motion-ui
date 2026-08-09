/** biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: the hook combines diff, capture, merge and lifecycle — splitting would scatter the refs they all share */
/** biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: the hook combines diff, capture, merge and lifecycle — splitting would scatter the refs */
/**
 * Hook that detects when entries are added to or removed from a file-system view's
 * row list, and manages the lifecycle of exit animations.
 *
 * Shared by list view (`FileSystemListView`) and columns view (`FileSystemColumn`).
 * Each view instance calls this hook with its current entries, folder path, and a
 * stable key extractor; the hook returns an augmented list that includes
 * still-exiting rows tagged with their animation state.
 */

import { useCallback, useRef, useState } from 'react';

/** The animation state a row carries into the view layer. */
export type RowAnimStatus = 'entering' | 'exiting';

/** An entry augmented with its animation status for the current render. */
export type AugmentedEntry<T> = T & { _animStatus?: RowAnimStatus };

export type UseFileSystemRowAnimationResult<T> = {
  augmentedEntries: AugmentedEntry<T>[];
  onExitComplete: (key: string) => void;
};

/**
 * Detects entering/exiting entries by diffing the current entry keys against the
 * previous render's. Suppresses animation on folder navigation (path change) and
 * on the very first render (no previous keys to diff against).
 *
 * @param currentEntries — the entries for the current folder/view
 * @param folderPath — disambiguates navigation from item moves
 * @param getKey — stable function that returns a unique key for each entry
 */
export function useFileSystemRowAnimation<T>(
  currentEntries: T[],
  folderPath: string,
  getKey: (entry: T) => string,
): UseFileSystemRowAnimationResult<T> {
  const prevKeysRef = useRef<string[]>([]);
  const prevEntriesRef = useRef<T[]>([]);
  const prevFolderRef = useRef(folderPath);

  // Exiting rows: key → { data, position }. Ref for synchronous access during
  // render; `exitTick` counter drives re-renders when an exit completes.
  const exitingRef = useRef<Map<string, { data: T; position: number }>>(new Map());
  // Read only as re-render trigger — the value is never consumed directly.
  const [_exitTick, setExitTick] = useState(0);

  const folderChanged = prevFolderRef.current !== folderPath;

  // ── Diff current vs previous ────────────────────────────────────────────────
  const currentKeys = currentEntries.map(getKey);
  const currentKeySet = new Set(currentKeys);
  const prevKeySet = new Set(prevKeysRef.current);

  const enteringSet = new Set<string>();
  const exitingSet = new Set<string>();

  const canDiff = !folderChanged && prevKeysRef.current.length > 0;
  if (canDiff) {
    for (const key of currentKeySet) {
      if (!(prevKeySet.has(key) || exitingRef.current.has(key))) enteringSet.add(key);
    }
    for (const key of prevKeySet) {
      if (!currentKeySet.has(key)) exitingSet.add(key);
    }
  }

  // ── Update exitingRef synchronously ─────────────────────────────────────────
  for (const key of enteringSet) exitingRef.current.delete(key);

  for (const key of exitingSet) {
    if (!exitingRef.current.has(key)) {
      const entry = prevEntriesRef.current.find((e) => getKey(e) === key);
      const position = prevKeysRef.current.indexOf(key);
      if (entry) exitingRef.current.set(key, { data: entry, position: position >= 0 ? position : prevKeysRef.current.length });
    }
  }

  if (folderChanged) exitingRef.current.clear();

  // ── Build augmented entries ─────────────────────────────────────────────────
  const augmentedEntries: AugmentedEntry<T>[] = [];

  for (const entry of currentEntries)
    augmentedEntries.push({ ...entry, _animStatus: enteringSet.has(getKey(entry)) ? 'entering' : undefined });

  // Insert exiting entries at their original positions, sorted front-to-back so
  // earlier insertions don't shift later targets.
  const exitingList = [...exitingRef.current.entries()].sort(([, a], [, b]) => a.position - b.position);
  for (const [, { data, position }] of exitingList)
    augmentedEntries.splice(Math.min(position, augmentedEntries.length), 0, {
      ...data,
      _animStatus: 'exiting' as const,
    });

  // ── Store for next render ───────────────────────────────────────────────────
  prevKeysRef.current = currentKeys;
  prevEntriesRef.current = currentEntries;
  prevFolderRef.current = folderPath;

  // ── Exit completion callback ─────────────────────────────────────────────────
  const onExitComplete = useCallback((key: string) => {
    if (exitingRef.current.delete(key)) setExitTick((t) => t + 1);
  }, []);

  return { augmentedEntries, onExitComplete };
}
