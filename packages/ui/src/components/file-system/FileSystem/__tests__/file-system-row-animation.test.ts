// The identity contract of the row-animation hook.
//
// The hook's visible job is tagging rows `entering`/`exiting`. Its other job — the
// one nothing else asserts and the one that decides what a drag costs — is *not*
// changing anything it does not have to. A view re-renders constantly during a drag
// (a scroll, a selection, the drag starting), and each of those re-renders calls
// this hook with the row list it already had. If the hook answers with a new array
// of new objects, every one of those re-renders rebuilds the whole list: `memo` on
// the row components cannot bite, and the `useMemo` chains hanging off the result
// (`overlayZones` → `overlayFolderPaths` → `renderItem`) all invalidate, so the
// FlatList re-renders every visible row. That is invisible in behaviour and shows
// up only as lag, which is why it is pinned here.

import { describe, expect, it } from 'vitest';
import { renderHook } from '../../../../hooks/__tests__/render-hook';
import { useFileSystemRowAnimation } from '../hooks/use-file-system-row-animation';

type Row = { path: string; label: string };

const getKey = (row: Row) => row.path;

const a: Row = { label: 'A', path: '/a' };
const b: Row = { label: 'B', path: '/b' };
const c: Row = { label: 'C', path: '/c' };

type Props = { entries: Row[]; folderPath: string; shouldAnimate?: boolean };

function mount(initial: Props) {
  return renderHook(
    ({ entries, folderPath, shouldAnimate }: Props) => useFileSystemRowAnimation(entries, folderPath, getKey, shouldAnimate),
    initial,
  );
}

describe('identity, when nothing changed', () => {
  it('returns the very same array for a re-render with the same rows', () => {
    const rows = [a, b];
    const harness = mount({ entries: rows, folderPath: '/' });
    const first = harness.current.augmentedEntries;

    harness.rerender({ entries: rows, folderPath: '/' });

    // The array a view feeds to its list. A new one here re-renders every row.
    expect(harness.current.augmentedEntries).toBe(first);
    harness.unmount();
  });

  it('holds that identity across many re-renders — a drag sweeping the list', () => {
    const rows = [a, b, c];
    const harness = mount({ entries: rows, folderPath: '/' });
    const first = harness.current.augmentedEntries;

    for (let i = 0; i < 20; i += 1) harness.rerender({ entries: rows, folderPath: '/' });

    expect(harness.current.augmentedEntries).toBe(first);
    harness.unmount();
  });

  it('passes un-animated rows through as the caller’s own objects', () => {
    const rows = [a, b];
    const harness = mount({ entries: rows, folderPath: '/' });

    // Not a copy: the row the caller memoized upstream is the row the list gets, so
    // a `memo`'d row component sees a stable prop.
    expect(harness.current.augmentedEntries[0]).toBe(a);
    expect(harness.current.augmentedEntries[1]).toBe(b);
    harness.unmount();
  });
});

describe('identity, when something did change', () => {
  it('rebuilds when a row is added, and tags it entering', () => {
    const harness = mount({ entries: [a, b], folderPath: '/' });
    const first = harness.current.augmentedEntries;

    harness.rerender({ entries: [a, b, c], folderPath: '/' });

    expect(harness.current.augmentedEntries).not.toBe(first);
    expect(harness.current.augmentedEntries).toHaveLength(3);
    expect(harness.current.augmentedEntries[2]?._animStatus).toBe('entering');
    harness.unmount();
  });

  it('clears the entering tag on the next render, then settles back to reuse', () => {
    const withC = [a, b, c];
    const harness = mount({ entries: [a, b], folderPath: '/' });
    harness.rerender({ entries: withC, folderPath: '/' });
    expect(harness.current.augmentedEntries[2]?._animStatus).toBe('entering');

    // The render after an entrance must rebuild — the cached array still carries the
    // tag, and handing it back would leave the row animating in forever.
    harness.rerender({ entries: withC, folderPath: '/' });
    expect(harness.current.augmentedEntries[2]?._animStatus).toBeUndefined();
    expect(harness.current.augmentedEntries[2]).toBe(c);

    // …and from there it is stable again.
    const settled = harness.current.augmentedEntries;
    harness.rerender({ entries: withC, folderPath: '/' });
    expect(harness.current.augmentedEntries).toBe(settled);
    harness.unmount();
  });

  it('keeps a removed row in place, tagged exiting, and rebuilds to do it', () => {
    const harness = mount({ entries: [a, b, c], folderPath: '/' });
    harness.rerender({ entries: [a, c], folderPath: '/' });

    const rows = harness.current.augmentedEntries;
    expect(rows.map((row) => row.path)).toEqual(['/a', '/b', '/c']);
    expect(rows[1]?._animStatus).toBe('exiting');
    harness.unmount();
  });

  it('rebuilds when the folder changes, and drops the exit animations with it', () => {
    const harness = mount({ entries: [a, b], folderPath: '/' });
    const first = harness.current.augmentedEntries;

    harness.rerender({ entries: [c], folderPath: '/other' });

    expect(harness.current.augmentedEntries).not.toBe(first);
    // Navigation is not an item leaving — nothing animates out of the old folder.
    expect(harness.current.augmentedEntries.map((row) => row.path)).toEqual(['/c']);
    harness.unmount();
  });

  it('rebuilds when the caller hands back an equal but different array', () => {
    const harness = mount({ entries: [a, b], folderPath: '/' });
    const first = harness.current.augmentedEntries;

    // A caller whose memo broke. The rows are the same, so nothing animates, but the
    // hook has no cheap way to know that and must not claim the cached array is it.
    harness.rerender({ entries: [a, b], folderPath: '/' });

    expect(harness.current.augmentedEntries).not.toBe(first);
    // The row objects themselves still pass through untouched.
    expect(harness.current.augmentedEntries[0]).toBe(a);
    harness.unmount();
  });
});
