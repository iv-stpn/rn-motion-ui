import { describe, expect, it } from 'vitest';
import type { FileSystemSelectionState } from '../logic/file-system-selection';
import {
  applyFileSystemDeselect,
  applyFileSystemMarquee,
  applyFileSystemSelection,
  EMPTY_FILE_SYSTEM_SELECTION,
  pruneFileSystemSelection,
  runBetween,
} from '../logic/file-system-selection';

const MULTIPLE = { mode: 'multiple' } as const;
const MULTIPLE_ADDITIVE = { mode: 'multiple', modifiers: { additive: true } } as const;
const SINGLE_ADDITIVE = { mode: 'single', modifiers: { additive: true } } as const;

/** The grid the ranges below run through. */
const ORDER = ['a', 'b', 'c', 'd', 'e'];
const MULTIPLE_RANGE = { mode: 'multiple', modifiers: { range: true }, orderedPaths: ORDER } as const;
const MULTIPLE_RANGE_ADDITIVE = { mode: 'multiple', modifiers: { additive: true, range: true }, orderedPaths: ORDER } as const;
const SINGLE_RANGE = { mode: 'single', modifiers: { range: true }, orderedPaths: ORDER } as const;

/** Members in a stable order, for assertions that do not care how they got there. */
function sorted(paths: ReadonlySet<string>): string[] {
  return [...paths].sort((a, b) => a.localeCompare(b));
}

/**
 * A selection of `paths`, the last one leading and anchoring — what a run of
 * additive presses builds.
 */
function selection(...paths: string[]): FileSystemSelectionState {
  const last = paths.at(-1) ?? null;
  return { anchor: last, lead: last, paths: new Set(paths) };
}

describe('applyFileSystemSelection', () => {
  it('replaces on a plain press', () => {
    const next = applyFileSystemSelection(selection('a', 'b'), 'c', MULTIPLE);
    expect(next).toEqual(selection('c'));
  });

  it('adds an unselected entry on an additive press and leads with it', () => {
    const next = applyFileSystemSelection(selection('a'), 'b', MULTIPLE_ADDITIVE);
    expect([...next.paths]).toEqual(['a', 'b']);
    expect(next.lead).toBe('b');
  });

  it('removes a selected entry on an additive press', () => {
    const next = applyFileSystemSelection(selection('a', 'b', 'c'), 'b', MULTIPLE_ADDITIVE);
    expect([...next.paths]).toEqual(['a', 'c']);
  });

  it('promotes the most recently added survivor when the lead is toggled off', () => {
    const next = applyFileSystemSelection(selection('a', 'b', 'c'), 'c', MULTIPLE_ADDITIVE);
    expect(next.lead).toBe('b');
  });

  it('leaves the lead alone when a non-lead member is toggled off', () => {
    const next = applyFileSystemSelection(selection('a', 'b', 'c'), 'a', MULTIPLE_ADDITIVE);
    expect(next.lead).toBe('c');
  });

  it('empties out when the last member is toggled off', () => {
    const next = applyFileSystemSelection(selection('a'), 'a', MULTIPLE_ADDITIVE);
    expect(next.lead).toBeNull();
    expect(next.paths.size).toBe(0);
  });

  it('ignores the additive modifier in single mode, so a Ctrl-click still selects', () => {
    const next = applyFileSystemSelection(selection('a'), 'b', SINGLE_ADDITIVE);
    expect(next).toEqual(selection('b'));
  });

  it('does not deselect in single mode when the sole selection is re-pressed additively', () => {
    const current = selection('a');
    expect(applyFileSystemSelection(current, 'a', SINGLE_ADDITIVE)).toBe(current);
  });

  it('clears on a null path', () => {
    expect(applyFileSystemSelection(selection('a', 'b'), null, MULTIPLE)).toEqual(EMPTY_FILE_SYSTEM_SELECTION);
  });

  it('returns the same state — not a copy — when the press changes nothing', () => {
    const current = selection('a');
    expect(applyFileSystemSelection(current, 'a', MULTIPLE)).toBe(current);
    expect(applyFileSystemSelection(EMPTY_FILE_SYSTEM_SELECTION, null, MULTIPLE)).toBe(EMPTY_FILE_SYSTEM_SELECTION);
  });

  it('replaces rather than no-ops when the pressed entry is one of several', () => {
    const current = selection('a', 'b');
    const next = applyFileSystemSelection(current, 'b', MULTIPLE);
    expect(next).not.toBe(current);
    expect([...next.paths]).toEqual(['b']);
  });
});

describe('applyFileSystemSelection — Shift range', () => {
  it('takes the run from the anchor down to the press', () => {
    const next = applyFileSystemSelection(selection('b'), 'd', MULTIPLE_RANGE);
    expect([...next.paths]).toEqual(['b', 'c', 'd']);
    expect(next.lead).toBe('d');
  });

  it('runs upward just the same', () => {
    const next = applyFileSystemSelection(selection('d'), 'b', MULTIPLE_RANGE);
    expect([...next.paths]).toEqual(['b', 'c', 'd']);
  });

  it('leaves the anchor put, so a second Shift-click re-measures from it', () => {
    const first = applyFileSystemSelection(selection('b'), 'e', MULTIPLE_RANGE);
    expect(first.anchor).toBe('b');
    // Shrinking the run is the same gesture as growing it — the origin holds.
    const second = applyFileSystemSelection(first, 'c', MULTIPLE_RANGE);
    expect([...second.paths]).toEqual(['b', 'c']);
    expect(second.anchor).toBe('b');
  });

  it('anchors on itself when there is no anchor yet', () => {
    const next = applyFileSystemSelection(EMPTY_FILE_SYSTEM_SELECTION, 'c', MULTIPLE_RANGE);
    expect([...next.paths]).toEqual(['c']);
    expect(next.anchor).toBe('c');
  });

  it('replaces the selection, dropping members outside the run', () => {
    const next = applyFileSystemSelection({ anchor: 'd', lead: 'a', paths: new Set(['a', 'd']) }, 'e', MULTIPLE_RANGE);
    expect([...next.paths]).toEqual(['d', 'e']);
  });

  it('adds the run to what is there when Ctrl is held too', () => {
    const next = applyFileSystemSelection({ anchor: 'd', lead: 'a', paths: new Set(['a', 'd']) }, 'e', MULTIPLE_RANGE_ADDITIVE);
    expect(sorted(next.paths)).toEqual(['a', 'd', 'e']);
  });

  it('falls back to an ordinary press when the anchor is not in this ordering', () => {
    const stale = { anchor: 'elsewhere/', lead: 'elsewhere/', paths: new Set(['elsewhere/']) };
    const next = applyFileSystemSelection(stale, 'c', MULTIPLE_RANGE);
    expect([...next.paths]).toEqual(['c']);
    expect(next.anchor).toBe('c');
  });

  it('falls back to an ordinary press with no ordering to measure against', () => {
    const next = applyFileSystemSelection(selection('a'), 'c', { mode: 'multiple', modifiers: { range: true } });
    expect([...next.paths]).toEqual(['c']);
  });

  it('ignores the range modifier in single mode', () => {
    const next = applyFileSystemSelection(selection('a'), 'd', SINGLE_RANGE);
    expect([...next.paths]).toEqual(['d']);
  });

  it('returns the same state when the run reselects exactly what is selected', () => {
    const current = applyFileSystemSelection(selection('b'), 'd', MULTIPLE_RANGE);
    expect(applyFileSystemSelection(current, 'd', MULTIPLE_RANGE)).toBe(current);
  });
});

describe('applyFileSystemMarquee', () => {
  it('takes exactly what the box covers', () => {
    const next = applyFileSystemMarquee(selection('z'), ['b', 'c'], null);
    expect([...next.paths]).toEqual(['b', 'c']);
    expect(next.lead).toBe('c');
  });

  it('anchors on the first entry the box reached', () => {
    expect(applyFileSystemMarquee(EMPTY_FILE_SYSTEM_SELECTION, ['b', 'c'], null).anchor).toBe('b');
  });

  it('unions with the base when the box was started additively', () => {
    const next = applyFileSystemMarquee(selection('a'), ['c'], new Set(['a']));
    expect(sorted(next.paths)).toEqual(['a', 'c']);
  });

  it('empties out — anchor included — when the box covers nothing', () => {
    const next = applyFileSystemMarquee(selection('a'), [], null);
    expect(next.paths.size).toBe(0);
    expect(next.anchor).toBeNull();
  });

  it('returns the same state while the box moves without changing what it covers', () => {
    const current = applyFileSystemMarquee(EMPTY_FILE_SYSTEM_SELECTION, ['b', 'c'], null);
    expect(applyFileSystemMarquee(current, ['b', 'c'], null)).toBe(current);
    // Order is not membership: a box growing leftward reaches the same two tiles.
    expect(applyFileSystemMarquee(current, ['c', 'b'], null)).toBe(current);
  });
});

describe('runBetween', () => {
  it('runs down from the start to the end, inclusive', () => {
    expect(runBetween('b', 'd', ORDER)).toEqual(['b', 'c', 'd']);
  });

  it('runs upward just the same', () => {
    expect(runBetween('d', 'b', ORDER)).toEqual(['b', 'c', 'd']);
  });

  it('is the single entry when both ends are the same', () => {
    expect(runBetween('c', 'c', ORDER)).toEqual(['c']);
  });

  it('returns null when either end is not in the ordering', () => {
    expect(runBetween('z', 'c', ORDER)).toBeNull();
    expect(runBetween('c', 'z', ORDER)).toBeNull();
  });
});

describe('applyFileSystemDeselect', () => {
  it('removes the covered run from the base', () => {
    const next = applyFileSystemDeselect(selection('a', 'b', 'c'), ['b'], new Set(['a', 'b', 'c']));
    expect(sorted(next.paths)).toEqual(['a', 'c']);
  });

  it('keeps the lead and anchor when they survive', () => {
    const next = applyFileSystemDeselect(selection('a', 'b', 'c'), ['a'], new Set(['a', 'b', 'c']));
    expect(next.lead).toBe('c');
    expect(next.anchor).toBe('c');
  });

  it('promotes the last survivor when the lead is removed', () => {
    const next = applyFileSystemDeselect(selection('a', 'b', 'c'), ['c'], new Set(['a', 'b', 'c']));
    expect([...next.paths]).toEqual(['a', 'b']);
    expect(next.lead).toBe('b');
    expect(next.anchor).toBe('b');
  });

  it('empties out — anchor included — when the run covers everything', () => {
    const next = applyFileSystemDeselect(selection('a', 'b'), ['a', 'b'], new Set(['a', 'b']));
    expect(next.paths.size).toBe(0);
    expect(next.lead).toBeNull();
    expect(next.anchor).toBeNull();
  });

  it('returns the same state — not a copy — when the run removes nothing', () => {
    const current = selection('a', 'b');
    expect(applyFileSystemDeselect(current, ['z'], new Set(['a', 'b']))).toBe(current);
    expect(applyFileSystemDeselect(current, [], new Set(['a', 'b']))).toBe(current);
  });

  it('re-adds a cleared run by re-measuring against the base, not the current state', () => {
    const base = new Set(['a', 'b', 'c']);
    const cleared = applyFileSystemDeselect(selection('a', 'b', 'c'), ['a', 'b', 'c'], base);
    expect(cleared.paths.size).toBe(0);
    // Dragging back so the finger leaves all but one of the cleared items brings
    // the rest back — the reducer never treats the empty selection as its origin.
    const reAdded = applyFileSystemDeselect(cleared, ['c'], base);
    expect(sorted(reAdded.paths)).toEqual(['a', 'b']);
  });
});

describe('pruneFileSystemSelection', () => {
  it('keeps everything when nothing is filtering', () => {
    const current = selection('a', 'b');
    expect(pruneFileSystemSelection(current, null)).toBe(current);
  });

  it('keeps the state identity when every member is still visible', () => {
    const current = selection('a', 'b');
    expect(pruneFileSystemSelection(current, new Set(['a', 'b', 'c']))).toBe(current);
  });

  it('drops members that fell out of view', () => {
    const next = pruneFileSystemSelection(selection('a', 'b', 'c'), new Set(['b']));
    expect([...next.paths]).toEqual(['b']);
    expect(next.lead).toBe('b');
  });

  it('re-leads when the lead was pruned but others survived', () => {
    const next = pruneFileSystemSelection(selection('a', 'b'), new Set(['a']));
    expect(next.lead).toBe('a');
  });

  it('empties out when nothing survives', () => {
    const next = pruneFileSystemSelection(selection('a', 'b'), new Set(['z']));
    expect(next.lead).toBeNull();
    expect(next.paths.size).toBe(0);
  });
});
