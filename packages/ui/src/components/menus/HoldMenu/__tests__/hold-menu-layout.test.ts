import { describe, expect, it, vi } from 'vitest';

// The layout module reads `Platform.OS` through the constants module; a stub
// keeps the pure math testable without loading react-native itself.
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));

import type { TransformOriginAnchorPosition } from '../hold-menu-types';
import type { HoldMenuPanelLeftInput } from '../layout';
import { resolveMenuAnchorPosition, resolveMenuPanelLeft, resolveRootViewportHeight } from '../layout';

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

/** Panel-left resolution — the nested-scroll row shape (full-width row, centre anchor). */
const panelLeft = (input: Omit<HoldMenuPanelLeftInput, 'safeLeft' | 'safeRight'>): number =>
  resolveMenuPanelLeft({ safeLeft: 0, safeRight: 0, ...input });

describe('resolveMenuPanelLeft', () => {
  it('keeps a centre-anchored panel on screen for a full-width row (the nested-scroll case)', () => {
    // Row spans nearly the whole 980 px window: itemX 32, itemWidth 869, menu 386.
    // The pop-in transform's net offset is +itemWidth (869), so the raw left
    // (-595.5) must NOT be clamped on its own — the VISUAL left (273.5) fits.
    const left = panelLeft({ anchorPosition: 'top-center', itemX: 32, itemWidth: 869, menuWidth: 386, windowWidth: 980 });
    expect(left).toBeCloseTo(-595.5, 1);
    expect(left + 869).toBeCloseTo(273.5, 1); // visual left inside 8..586
  });

  it('clamps a centre-anchored panel into the left edge', () => {
    // Visual left -127 → clamped to 8; the style left backs out the net offset.
    expect(panelLeft({ anchorPosition: 'top-center', itemX: 16, itemWidth: 100, menuWidth: 386, windowWidth: 980 })).toBeCloseTo(
      -92,
      1,
    );
  });

  it('clamps a centre-anchored panel into the right edge', () => {
    // Visual left 737 → clamped to 586 (980 - 8 - 386); style left backs out 100.
    expect(panelLeft({ anchorPosition: 'top-center', itemX: 880, itemWidth: 100, menuWidth: 386, windowWidth: 980 })).toBeCloseTo(
      486,
      1,
    );
  });

  it('leaves right anchors untouched (net transform offset is 0)', () => {
    // Panel left = 180 + (-240 + 200) = 140, inside 8..152 — same as the raw clamp.
    expect(panelLeft({ anchorPosition: 'top-right', itemX: 180, itemWidth: 200, menuWidth: 240, windowWidth: 400 })).toBe(140);
  });

  it('leaves left anchors untouched (net transform offset is 0)', () => {
    expect(panelLeft({ anchorPosition: 'top-left', itemX: 16, itemWidth: 40, menuWidth: 240, windowWidth: 400 })).toBe(16);
  });
});

describe('resolveRootViewportHeight', () => {
  it('caps the root to the visible window when the root is taller (provider inside a scroll view)', () => {
    // Native storybook shape: the root's height is the full scrollable content.
    expect(resolveRootViewportHeight(1300, 0, 800)).toBe(800);
  });

  it('keeps a root shorter than the window (storybook web padding decorator)', () => {
    expect(resolveRootViewportHeight(189, 24, 237)).toBe(189);
  });

  it('grows the visible extent when the root is scrolled up under the fold', () => {
    // Root top at viewport -500: the visible part spans 500..1300 in root space.
    expect(resolveRootViewportHeight(1300, -500, 800)).toBe(1300);
  });

  it('is the window height for a full-screen root', () => {
    expect(resolveRootViewportHeight(800, 0, 800)).toBe(800);
  });
});
