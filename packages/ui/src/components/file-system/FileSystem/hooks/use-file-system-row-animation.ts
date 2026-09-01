import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * How long the exit animation takes at full speed. If the animation callback
 * never fires (e.g. Reanimated worklet runner not set up in a test), the
 * timeout fallback drops the stale entry after this window plus some buffer.
 */
const EXIT_ANIM_DURATION_MS = 400;

/** Shared empty source for the key sets the unchanged path skips building. */
const NO_KEYS: readonly string[] = [];

/** The animation state a row carries into the view layer. */
type RowAnimStatus = 'entering' | 'exiting';

/** An entry augmented with its animation status for the current render. */
type AugmentedEntry<T> = T & { _animStatus?: RowAnimStatus };

/** One row in the exiting map: `[key, { data, position }]`. */
type ExitEntry<T> = readonly [string, { data: T; position: number }];

/** The two key sets a diff produces: newly entering and newly exiting. */
type DiffResult = { enteringSet: Set<string>; exitingSet: Set<string> };

/** Sort exiting rows front-to-back so earlier insertions don't shift later targets. */
function byPosition<T>(a: ExitEntry<T>, b: ExitEntry<T>): number {
  return a[1].position - b[1].position;
}

/** Diff the current key set against the previous one into entering/exiting sets. */
function diffKeys(
  currentKeySet: ReadonlySet<string>,
  prevKeySet: ReadonlySet<string>,
  exitingKeys: ReadonlyMap<string, unknown>,
): DiffResult {
  const enteringSet = new Set<string>();
  const exitingSet = new Set<string>();
  for (const key of currentKeySet) {
    if (!(prevKeySet.has(key) || exitingKeys.has(key))) enteringSet.add(key);
  }
  for (const key of prevKeySet) {
    if (!currentKeySet.has(key)) exitingSet.add(key);
  }
  return { enteringSet, exitingSet };
}

/** Resolve the data + position for new exiting keys from the previous render's entries. */
function resolveNewExitingEntries<T>(
  newKeys: readonly string[],
  prevEntries: readonly T[],
  prevKeys: readonly string[],
  getKey: (entry: T) => string,
): [string, { data: T; position: number }][] {
  const newEntries: [string, { data: T; position: number }][] = [];
  for (const key of newKeys) {
    const entry = prevEntries.find((e) => getKey(e) === key);
    if (entry) {
      const index = prevKeys.indexOf(key);
      newEntries.push([key, { data: entry, position: index >= 0 ? index : prevKeys.length }]);
    }
  }
  return newEntries;
}

/**
 * Fold the current entries and the still-exiting rows into one augmented list.
 *
 * Two identity rules, both load-bearing for the views that consume this.
 *
 * A row with no animation status is passed through *as it came in* rather than
 * shallow-copied. The copy was the expensive part: it gave every row a new
 * identity on every render, so any re-render of the view — a scroll, a selection,
 * a drag crossing — rebuilt the entire list, defeated `memo` on the row
 * components, and churned the `useMemo`/`useCallback` chains that hang off this
 * array. Steady state is now literally the caller's own array elements, which
 * are memoized upstream.
 */
function buildAugmentedEntries<T>(
  currentEntries: readonly T[],
  enteringSet: ReadonlySet<string>,
  exitingList: readonly ExitEntry<T>[],
  getKey: (entry: T) => string,
): AugmentedEntry<T>[] {
  const result: AugmentedEntry<T>[] = [];
  for (const entry of currentEntries) {
    // Only a row that is actually animating needs the wrapper object.
    if (enteringSet.has(getKey(entry))) result.push({ ...entry, _animStatus: 'entering' as const });
    // biome-ignore lint/plugin: ts/no-as-cast — `_animStatus` is optional, so every `T` already *is* an `AugmentedEntry<T>` at runtime; TS just cannot prove that for an unconstrained generic. Passing the caller's own object through, rather than copying it, is the point of this branch.
    else result.push(entry as AugmentedEntry<T>);
  }

  // Insert exiting entries at their original positions, sorted front-to-back so
  // earlier insertions don't shift later targets.
  for (const [, { data, position }] of exitingList)
    result.splice(Math.min(position, result.length), 0, {
      ...data,
      _animStatus: 'exiting' as const,
    });
  return result;
}

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

export type { AugmentedEntry };

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
  const needsDiff = cached === null;

  // ── Diff current vs previous ────────────────────────────────────────────────
  const currentKeys = needsDiff ? currentEntries.map(getKey) : prevKeysRef.current;
  const currentKeySet = new Set(needsDiff ? currentKeys : NO_KEYS);
  const prevKeySet = new Set(needsDiff ? prevKeysRef.current : NO_KEYS);

  const canDiff = needsDiff && !(folderChanged || animateToggled) && shouldAnimate && prevKeysRef.current.length > 0;
  const { enteringSet, exitingSet } = canDiff
    ? diffKeys(currentKeySet, prevKeySet, exitingRef.current)
    : { enteringSet: new Set<string>(), exitingSet: new Set<string>() };

  // ── Update exitingRef synchronously ─────────────────────────────────────────
  for (const key of enteringSet) exitingRef.current.delete(key);
  const newExiting = resolveNewExitingEntries(
    [...exitingSet].filter((key) => !exitingRef.current.has(key)),
    prevEntriesRef.current,
    prevKeysRef.current,
    getKey,
  );
  for (const [key, value] of newExiting) exitingRef.current.set(key, value);

  if (folderChanged || animateToggled) exitingRef.current.clear();

  const exitingList = needsDiff ? [...exitingRef.current.entries()].sort(byPosition) : [];

  let augmentedEntries: AugmentedEntry<T>[];
  if (needsDiff) augmentedEntries = buildAugmentedEntries(currentEntries, enteringSet, exitingList, getKey);
  else augmentedEntries = cached;

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
