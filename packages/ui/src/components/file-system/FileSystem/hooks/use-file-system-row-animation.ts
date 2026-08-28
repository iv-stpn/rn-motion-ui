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

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * How long the exit animation takes at full speed. If the animation callback
 * never fires (e.g. Reanimated worklet runner not set up in a test), the
 * timeout fallback drops the stale entry after this window plus some buffer.
 */
const EXIT_ANIM_DURATION_MS = 400;

/** Shared empty source for the key sets the unchanged path skips building. */
const NO_KEYS: readonly string[] = [];

/**
 * Timeout-managed cleanup for exiting entries. The callback-based path
 * (`onExitComplete`) is the primary removal mechanism — a timeout is only
 * scheduled as a safety net for environments where the animation callback
 * never fires (e.g. a vitest browser without Reanimated's worklet runtime).
 */
function useExitTimeout(onExitComplete: (key: string) => void): (key: string) => void {
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const onExitRef = useRef(onExitComplete);
  onExitRef.current = onExitComplete;

  // Cleanup all pending timeouts on unmount.
  // biome-ignore lint/plugin: imperative teardown, not data-fetching or render-driving state
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const id of timers.values()) clearTimeout(id);
      timers.clear();
    };
  }, []);

  return useCallback((key: string) => {
    // Clear any previous timeout for this key (entry re-entering).
    const prev = timersRef.current.get(key);
    if (prev) clearTimeout(prev);
    const id = setTimeout(() => {
      timersRef.current.delete(key);
      onExitRef.current(key);
    }, EXIT_ANIM_DURATION_MS);
    timersRef.current.set(key, id);
  }, []);
}

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
 * @param shouldAnimate — when false (e.g. while a filter is active), entries
 *   that leave the list are filtered out rather than removed from data — they
 *   should vanish instantly with no exit animation. When this flag toggles in
 *   either direction, all tracked exits are cleared so stale state cannot bleed
 *   into the next render.
 */
export function useFileSystemRowAnimation<T>(
  currentEntries: T[],
  folderPath: string,
  getKey: (entry: T) => string,
  shouldAnimate = true,
): UseFileSystemRowAnimationResult<T> {
  const prevKeysRef = useRef<string[]>([]);
  const prevEntriesRef = useRef<T[]>([]);
  const prevFolderRef = useRef(folderPath);
  const prevShouldAnimateRef = useRef(shouldAnimate);
  // The three refs the identity reuse below rests on: the array last handed out,
  // whether it carries `entering` tags that the next render has to clear, and how
  // many exiting rows were folded into it.
  const prevResultRef = useRef<AugmentedEntry<T>[] | null>(null);
  const prevHadEnteringRef = useRef(false);
  const prevExitingCountRef = useRef(0);

  // Exiting rows: key → { data, position }. Ref for synchronous access during
  // render; `exitTick` counter drives re-renders when an exit completes.
  const exitingRef = useRef<Map<string, { data: T; position: number }>>(new Map());
  // Read only as re-render trigger — the value is never consumed directly.
  const [_exitTick, setExitTick] = useState(0);

  const folderChanged = prevFolderRef.current !== folderPath;
  const animateToggled = prevShouldAnimateRef.current !== shouldAnimate;

  // ── The unchanged case ──────────────────────────────────────────────────────
  //
  // The caller handed back the very same array, in the same folder, with no exit
  // in flight and no `entering` tag left to clear. Nothing can have entered or
  // left, so the whole diff below — three `Set`s and a `map` over every row — is
  // provably a no-op, and the answer is the array we returned last time.
  //
  // This is the overwhelmingly common call: a view re-renders for a scroll, a
  // selection, a drag starting, and its row list is untouched. Paying O(rows) in
  // allocations to rediscover that on every one of those is what made a view's
  // re-render cost scale with how much was in it.
  const unchanged =
    currentEntries === prevEntriesRef.current &&
    !(folderChanged || animateToggled) &&
    !prevHadEnteringRef.current &&
    exitingRef.current.size === prevExitingCountRef.current;
  const cached = unchanged ? prevResultRef.current : null;

  // ── Diff current vs previous ────────────────────────────────────────────────
  const currentKeys = cached === null ? currentEntries.map(getKey) : prevKeysRef.current;
  const currentKeySet = new Set(cached === null ? currentKeys : NO_KEYS);
  const prevKeySet = new Set(cached === null ? prevKeysRef.current : NO_KEYS);

  const enteringSet = new Set<string>();
  const exitingSet = new Set<string>();

  const canDiff = cached === null && !(folderChanged || animateToggled) && shouldAnimate && prevKeysRef.current.length > 0;
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

  if (folderChanged || animateToggled) exitingRef.current.clear();

  // ── Build augmented entries ─────────────────────────────────────────────────
  //
  // Two identity rules, both load-bearing for the views that consume this.
  //
  // A row with no animation status is passed through *as it came in* rather than
  // shallow-copied. The copy was the expensive part: it gave every row a new
  // identity on every render, so any re-render of the view — a scroll, a selection,
  // a drag crossing — rebuilt the entire list, defeated `memo` on the row
  // components, and churned the `useMemo`/`useCallback` chains that hang off this
  // array (`overlayZones` → `overlayFolderPaths` → `renderItem`). Steady state is
  // now literally the caller's own array elements, which are memoized upstream.
  //
  // And the array itself is reused whole when the `unchanged` test above held —
  // the common case by far, since exits and entrances happen only when the
  // folder's contents actually change.
  const exitingList = cached === null ? [...exitingRef.current.entries()].sort(([, a], [, b]) => a.position - b.position) : [];

  let augmentedEntries: AugmentedEntry<T>[];
  if (cached === null) {
    augmentedEntries = [];
    for (const entry of currentEntries) {
      // Only a row that is actually animating needs the wrapper object.
      if (enteringSet.has(getKey(entry))) augmentedEntries.push({ ...entry, _animStatus: 'entering' as const });
      // biome-ignore lint/plugin: ts/no-as-cast — `_animStatus` is optional, so every `T` already *is* an `AugmentedEntry<T>` at runtime; TS just cannot prove that for an unconstrained generic. Passing the caller's own object through, rather than copying it, is the point of this branch.
      else augmentedEntries.push(entry as AugmentedEntry<T>);
    }

    // Insert exiting entries at their original positions, sorted front-to-back so
    // earlier insertions don't shift later targets.
    for (const [, { data, position }] of exitingList)
      augmentedEntries.splice(Math.min(position, augmentedEntries.length), 0, {
        ...data,
        _animStatus: 'exiting' as const,
      });
  } else augmentedEntries = cached;

  // ── Store for next render ───────────────────────────────────────────────────
  prevKeysRef.current = currentKeys;
  prevEntriesRef.current = currentEntries;
  prevFolderRef.current = folderPath;
  prevShouldAnimateRef.current = shouldAnimate;
  // Whether *this* render tagged anything `entering`: the next render must rebuild
  // to clear those tags, so a reuse cannot hand back a row still marked as entering.
  prevHadEnteringRef.current = enteringSet.size > 0;
  // Read off the map, not off `exitingList` — the unchanged path never builds that
  // list, and zeroing the count here would make the next render think an exit had
  // completed and rebuild for nothing.
  prevExitingCountRef.current = exitingRef.current.size;
  prevResultRef.current = augmentedEntries;

  // ── Exit completion callback ─────────────────────────────────────────────────
  const onExitComplete = useCallback((key: string) => {
    if (exitingRef.current.delete(key)) setExitTick((t) => t + 1);
  }, []);

  // Timeout safety net for environments where the animation callback never
  // fires (e.g. a test without the Reanimated worklet runner). Schedules a
  // removal for every new exiting entry; the primary `onExitComplete` path
  // still clears it first.
  const scheduleExitTimeout = useExitTimeout(onExitComplete);
  for (const [, { data }] of exitingList) scheduleExitTimeout(getKey(data));

  return { augmentedEntries, onExitComplete };
}
