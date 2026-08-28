import { describe, expect, it } from 'vitest';
import type { FileSystemScrubHit } from '../logic/file-system-scrub';
import { resolveScrubDirection, resolveScrubRun } from '../logic/file-system-scrub';

/** The list the runs below measure through. */
const ORDER = ['a', 'b', 'c', 'd', 'e'];

const item = (path: string): NonNullable<FileSystemScrubHit> => ({ kind: 'item', path });
const beyond = (side: 'above' | 'below'): NonNullable<FileSystemScrubHit> => ({ kind: 'beyond', side });

describe('resolveScrubRun', () => {
  it('runs from the anchor to the finger over an entry, inclusive', () => {
    expect(resolveScrubRun('c', null, item('e'), ORDER)).toEqual(['c', 'd', 'e']);
    expect(resolveScrubRun('c', null, item('a'), ORDER)).toEqual(['a', 'b', 'c']);
  });

  it('over-drags below in a downward drag keeping the anchor', () => {
    expect(resolveScrubRun('c', 'below', beyond('below'), ORDER)).toEqual(['c', 'd', 'e']);
  });

  it('over-drags above in an upward drag keeping the anchor', () => {
    expect(resolveScrubRun('c', 'above', beyond('above'), ORDER)).toEqual(['a', 'b', 'c']);
  });

  it('cancels the anchor when over-dragging opposite the drag direction', () => {
    // Set off downward, reversed and over-dragged past the top: the anchor drops.
    expect(resolveScrubRun('c', 'below', beyond('above'), ORDER)).toEqual(['a', 'b']);
    // Set off upward, reversed and over-dragged past the bottom: the anchor drops.
    expect(resolveScrubRun('c', 'above', beyond('below'), ORDER)).toEqual(['d', 'e']);
  });

  it('keeps the anchor on the first over-drag before a direction is known', () => {
    expect(resolveScrubRun('c', null, beyond('below'), ORDER)).toEqual(['c', 'd', 'e']);
    expect(resolveScrubRun('c', null, beyond('above'), ORDER)).toEqual(['a', 'b', 'c']);
  });

  it('returns null when the anchor is not in the ordering', () => {
    expect(resolveScrubRun('z', null, beyond('below'), ORDER)).toBeNull();
    expect(resolveScrubRun('z', 'below', item('c'), ORDER)).toBeNull();
  });
});

describe('resolveScrubDirection', () => {
  it('reports the side of an over-drag', () => {
    expect(resolveScrubDirection('c', beyond('below'), ORDER)).toBe('below');
    expect(resolveScrubDirection('c', beyond('above'), ORDER)).toBe('above');
  });

  it('reports below when the finger moves past the anchor and above when it moves back', () => {
    expect(resolveScrubDirection('c', item('d'), ORDER)).toBe('below');
    expect(resolveScrubDirection('c', item('b'), ORDER)).toBe('above');
  });

  it('reports null while the finger is still on the anchor', () => {
    expect(resolveScrubDirection('c', item('c'), ORDER)).toBeNull();
  });

  it('reports null when either path is not in the ordering', () => {
    expect(resolveScrubDirection('z', item('c'), ORDER)).toBeNull();
    expect(resolveScrubDirection('c', item('z'), ORDER)).toBeNull();
  });
});
