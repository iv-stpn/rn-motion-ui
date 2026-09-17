import { describe, expect, it, vi } from 'vitest';

// The layout module reads `Platform.OS` through the constants module; a stub
// keeps the pure math testable without loading react-native itself.
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));

import type { MenuItemProps, TransformOriginAnchorPosition } from '../hold-menu-types';
import type { HoldMenuPanelLeftInput } from '../layout';
import {
  calculateMenuHeight,
  clampMenuLeft,
  deepEqual,
  getTransformOrigin,
  leftOrRight,
  menuAnimationAnchor,
  menuPanelHeight,
  resolveHoldMenuTravel,
  resolveMenuAnchorPosition,
  resolveMenuPanelLeft,
  resolveMenuWidth,
  resolveRootViewportHeight,
} from '../layout';

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

describe('resolveMenuWidth', () => {
  it('floors content below the minimum to the minimum width', () => {
    expect(resolveMenuWidth(80, 1000)).toBe(160);
  });

  it('sizes to content between the floor and the window-ratio cap', () => {
    expect(resolveMenuWidth(200, 1000)).toBe(200);
  });

  it('caps content at the window-ratio maximum', () => {
    expect(resolveMenuWidth(600, 1000)).toBe(400);
  });

  it('rounds fractional content up so the panel is never narrower than its rows', () => {
    expect(resolveMenuWidth(180.4, 1000)).toBe(181);
  });
});

describe('calculateMenuHeight', () => {
  const item = (withSeparator = false): MenuItemProps => ({ text: 'x', withSeparator });

  it('sizes a single row to border + row height', () => {
    // border 4 + segmented-list padding 0 + one row 40 = 44.
    expect(calculateMenuHeight([item()])).toBe(44);
  });

  it('adds the separator band for a row that draws one', () => {
    // 44 + separator band 8 = 52.
    expect(calculateMenuHeight([item(true)])).toBe(52);
  });

  it('adds a hairline seam between rows', () => {
    // 4 + 40×3 + (3−1)×2 = 4 + 120 + 4 = 128.
    expect(calculateMenuHeight([item(), item(), item()])).toBe(128);
  });

  it('combines separator bands and seams', () => {
    // 4 + 120 + 8 (one separator) + 4 (two seams) = 136.
    expect(calculateMenuHeight([item(), item(true), item()])).toBe(136);
  });
});

describe('getTransformOrigin', () => {
  it('picks the left half when the item sits on the left', () => {
    // centre x = 20, distanceToLeft 20 < distanceToRight 380.
    expect(getTransformOrigin(0, 40, 400)).toBe('top-left');
  });

  it('picks the right half when the item sits on the right', () => {
    // centre x = 380, distanceToLeft 380 > distanceToRight 20.
    expect(getTransformOrigin(360, 40, 400)).toBe('top-right');
  });

  it('picks centre within the tolerance band', () => {
    // centre x = 200, distances equal → majority 0 < 10.
    expect(getTransformOrigin(180, 40, 400)).toBe('top-center');
  });

  it('uses the bottom half when bottom is set', () => {
    expect(getTransformOrigin(0, 40, 400, true)).toBe('bottom-left');
    expect(getTransformOrigin(180, 40, 400, true)).toBe('bottom-center');
  });
});

describe('menuPanelHeight', () => {
  it('caps the panel to the max height when it overflows', () => {
    expect(menuPanelHeight(200, 150)).toBe(150);
  });

  it('keeps the estimate when it fits', () => {
    expect(menuPanelHeight(200, 300)).toBe(200);
  });

  it('never drops below one row (44 px)', () => {
    expect(menuPanelHeight(200, 0)).toBe(44);
    expect(menuPanelHeight(200, 10)).toBe(44);
  });
});

describe('resolveHoldMenuTravel', () => {
  const input = (overrides: Partial<Parameters<typeof resolveHoldMenuTravel>[0]>) => ({
    itemY: 100,
    itemHeight: 40,
    menuHeight: 200,
    disableMove: false,
    opensBelow: true,
    windowHeight: 800,
    safeTop: 0,
    safeBottom: 0,
    ...overrides,
  });

  it('does not travel when the panel fits below', () => {
    expect(resolveHoldMenuTravel(input({}))).toEqual({ tY: 0, maxHeight: 644 });
  });

  it('travels up when the panel overflows below', () => {
    // room = 300 − 8 − 148 = 144, overflow 56 → tY −56, cap 200.
    expect(resolveHoldMenuTravel(input({ windowHeight: 300 }))).toEqual({ tY: -56, maxHeight: 200 });
  });

  it('clamps upward travel so the item top stays in the safe area', () => {
    // itemY 10 → bound −2, so only 2 px of the 166 px overflow is travelled.
    expect(resolveHoldMenuTravel(input({ itemY: 10, menuHeight: 400, windowHeight: 300 }))).toEqual({ tY: -2, maxHeight: 236 });
  });

  it('does not travel when the panel fits above', () => {
    expect(resolveHoldMenuTravel(input({ itemY: 500, opensBelow: false, windowHeight: 600 }))).toEqual({ tY: 0, maxHeight: 484 });
  });

  it('travels down when the panel overflows above', () => {
    // room = 500 − 8 − 8 = 184, overflow 116 → tY 116, cap 300.
    expect(resolveHoldMenuTravel(input({ itemY: 200, menuHeight: 300, opensBelow: false, windowHeight: 600 }))).toEqual({
      tY: 116,
      maxHeight: 300,
    });
  });

  it('pins the item and gives the panel the whole room when disableMove is set', () => {
    expect(resolveHoldMenuTravel(input({ disableMove: true, windowHeight: 300 }))).toEqual({ tY: 0, maxHeight: 144 });
  });

  it('floors the max height at zero when there is no room', () => {
    // room = 100 − 8 − 148 = −56 → clamped to 0.
    expect(resolveHoldMenuTravel(input({ disableMove: true, windowHeight: 100 }))).toEqual({ tY: 0, maxHeight: 0 });
  });
});

describe('menuAnimationAnchor', () => {
  it('mirrors the beginning/ending translateX for a right anchor', () => {
    const anchor = menuAnimationAnchor('top-right', 100, 200, 300);
    expect(anchor.beginningTransformations.translateX).toBe(150);
    expect(anchor.endingTransformations.translateX).toBe(-150);
  });

  it('keeps the TyTop1 quirk for bottom anchors (beginning reuses the top value)', () => {
    const anchor = menuAnimationAnchor('bottom-right', 100, 200, 300);
    expect(anchor.beginningTransformations.translateY).toBe(-100);
    expect(anchor.endingTransformations.translateY).toBe(-100);
  });

  it('centres the panel horizontally on the item for the centre anchor', () => {
    const anchor = menuAnimationAnchor('top-center', 100, 200, 300);
    // Horizontal half is `center` (uses the item width / zero), vertical half is `top`.
    expect(anchor.beginningTransformations.translateX).toBe(100);
    expect(anchor.beginningTransformations.translateY).toBe(-100);
    expect(anchor.endingTransformations.translateX).toBe(0);
    expect(anchor.endingTransformations.translateY).toBe(100);
  });
});

describe('leftOrRight', () => {
  it('offsets a right anchor by the panel minus the item', () => {
    expect(leftOrRight('top-right', 120, 300)).toBe(-180);
  });

  it('leaves a left anchor at zero', () => {
    expect(leftOrRight('top-left', 120, 300)).toBe(0);
  });

  it('uses the centre formula for a centre anchor', () => {
    // −120 − 150 + 60 = −210.
    expect(leftOrRight('top-center', 120, 300)).toBe(-210);
  });
});

describe('clampMenuLeft', () => {
  it('leaves an in-range left untouched', () => {
    expect(clampMenuLeft({ left: 50, menuWidth: 240, windowWidth: 400, safeLeft: 0, safeRight: 0 })).toBe(50);
  });

  it('clamps a left that runs off the left edge', () => {
    expect(clampMenuLeft({ left: -20, menuWidth: 240, windowWidth: 400, safeLeft: 0, safeRight: 0 })).toBe(8);
  });

  it('clamps a left that runs off the right edge', () => {
    // max = 400 − 8 − 240 = 152.
    expect(clampMenuLeft({ left: 200, menuWidth: 240, windowWidth: 400, safeLeft: 0, safeRight: 0 })).toBe(152);
  });
});

describe('deepEqual', () => {
  const item = (text: string): MenuItemProps => ({ text });

  it('treats empty lists as equal', () => {
    expect(deepEqual([], [])).toBe(true);
  });

  it('treats equal item lists as equal', () => {
    expect(deepEqual([item('a'), item('b')], [item('a'), item('b')])).toBe(true);
  });

  it('treats differing item lists as unequal', () => {
    expect(deepEqual([item('a')], [item('b')])).toBe(false);
  });

  it('treats lists of different lengths as unequal', () => {
    expect(deepEqual([item('a')], [item('a'), item('b')])).toBe(false);
  });
});
