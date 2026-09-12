import { describe, expect, it } from 'vitest';
import {
  isClampedScroll,
  isRestoreConfirmed,
  SCROLL_RESTORE_TOLERANCE,
  type ScrollNode,
  toScrollNode,
} from '../logic/file-system-scroll';

describe('toScrollNode', () => {
  it('reduces a non-Element (native handle, null, plain object) to null', () => {
    expect(toScrollNode(null)).toBeNull();
    expect(toScrollNode(undefined)).toBeNull();
    expect(toScrollNode(42)).toBeNull();
    expect(toScrollNode({})).toBeNull();
  });

  it('keeps a DOM element, exposing its offsetParent', () => {
    const node = toScrollNode(document.createElement('div'));
    expect(node).not.toBeNull();
    expect(node).toHaveProperty('offsetParent');
  });
});

describe('isClampedScroll', () => {
  it('suppresses a hidden node (offsetParent null)', () => {
    const hidden: ScrollNode = { offsetParent: null };
    expect(isClampedScroll(hidden)).toBe(true);
  });

  it('reports a laid-out node (offsetParent non-null)', () => {
    const visible: ScrollNode = { offsetParent: {} };
    expect(isClampedScroll(visible)).toBe(false);
  });

  it('fails open on an unknown node, so a real scroll is never dropped', () => {
    expect(isClampedScroll(null)).toBe(false);
    expect(isClampedScroll(undefined)).toBe(false);
  });
});

describe('isRestoreConfirmed', () => {
  it('confirms an exact landing', () => {
    expect(isRestoreConfirmed(600, 600)).toBe(true);
  });

  it(`absorbs fractional rounding within ${SCROLL_RESTORE_TOLERANCE}px`, () => {
    expect(isRestoreConfirmed(600 + SCROLL_RESTORE_TOLERANCE, 600)).toBe(true);
    expect(isRestoreConfirmed(600 - SCROLL_RESTORE_TOLERANCE, 600)).toBe(true);
  });

  it('leaves the pending offset armed past the tolerance, so it retries', () => {
    expect(isRestoreConfirmed(600 + SCROLL_RESTORE_TOLERANCE + 1, 600)).toBe(false);
    expect(isRestoreConfirmed(600 - SCROLL_RESTORE_TOLERANCE - 1, 600)).toBe(false);
  });
});
