import { describe, expect, it, vi } from 'vitest';

// The layout module reads `Platform.OS` through the constants module; a stub
// keeps the pure math testable without loading react-native itself.
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));

import type { TransformOriginAnchorPosition } from '../hold-menu-types';
import { resolveMenuAnchorPosition } from '../layout';

/** Square viewport, no insets — a 240 px panel leaves an 8..152 px range. */
const WINDOW_WIDTH = 400;
const MENU_WIDTH = 240;

const resolve = (anchor: TransformOriginAnchorPosition, itemX: number, itemWidth: number): TransformOriginAnchorPosition =>
  resolveMenuAnchorPosition({
    anchor,
    itemX,
    itemWidth,
    menuWidth: MENU_WIDTH,
    windowWidth: WINDOW_WIDTH,
    safeLeft: 0,
    safeRight: 0,
  });

describe('resolveMenuAnchorPosition', () => {
  it('keeps a right anchor that fits (item on the right half)', () => {
    // Panel left = 180 + (-240 + 200) = 140, inside 8..152.
    expect(resolve('top-right', 180, 200)).toBe('top-right');
  });

  it('flips a right anchor to left when the item hugs the left edge', () => {
    // Right anchor left = 16 + (-240 + 40) = -184 → off-screen left; left anchor left = 16 fits.
    expect(resolve('top-right', 16, 40)).toBe('top-left');
  });

  it('keeps a left anchor that fits (item on the left half)', () => {
    expect(resolve('top-left', 16, 40)).toBe('top-left');
  });

  it('flips a left anchor to right when the item hugs the right edge', () => {
    // Left anchor left = 350 > 152 → off-screen right; right anchor left = 150 fits.
    expect(resolve('top-left', 350, 40)).toBe('top-right');
  });

  it('preserves the vertical half when flipping', () => {
    expect(resolve('bottom-right', 16, 40)).toBe('bottom-left');
  });

  it('leaves a centre anchor alone', () => {
    expect(resolve('top-center', 150, 100)).toBe('top-center');
  });

  it('keeps the hint when both sides would overflow — the viewport clamp is the fallback', () => {
    // itemX = 200: right anchor left = 0 (off-screen left), left anchor left = 200 (off-screen right).
    expect(resolve('top-right', 200, 40)).toBe('top-right');
  });
});
