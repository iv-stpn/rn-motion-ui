import { describe, expect, it, vi } from 'vitest';

// The layout module reads `Platform.OS` through the constants/theme modules;
// a stub keeps the pure math testable without loading react-native itself.
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));

import {
  calculateMenuHeight,
  calculateTransformValue,
  clampMenuLeft,
  getTransformOrigin,
  leftOrRight,
  menuAnimationAnchor,
  menuItemHeight,
  menuMaxHeight,
  menuPanelHeight,
  resolveHoldMenuTravel,
} from '../hold-menu-layout';

/** Square viewport, no insets — every expectation below is arithmetic on round numbers. */
const VIEWPORT = { width: 400, height: 800 };
const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 };

/** A real device, to check the insets are actually subtracted rather than assumed zero. */
const PHONE = { width: 390, height: 844 };
const PHONE_INSETS = { top: 47, bottom: 34, left: 0, right: 0 };

describe('menuItemHeight / calculateMenuHeight', () => {
  it('is the callout line height plus the row padding at default font scale', () => {
    // 20 (callout lineHeight) + 8 * 2.5 = 40.
    expect(menuItemHeight(1)).toBe(40);
  });

  it('scales with the font scale', () => {
    expect(menuItemHeight(1.3)).toBe(20 * 1.3 + 20);
  });

  it('counts one row per item plus the inter-row seam', () => {
    // 40 * 3 + (3 - 1) = 122.
    expect(calculateMenuHeight(3, 0)).toBe(122);
  });

  it('adds a separator band per separator', () => {
    expect(calculateMenuHeight(3, 2)).toBe(122 + 2 * 8);
  });

  it("is -1 for no items — upstream's verbatim formula counts (length - 1) seams", () => {
    // Upstream never guards the empty list; the -1 seam is part of its exact math.
    expect(calculateMenuHeight(0, 0)).toBe(-1);
  });
});

describe('getTransformOrigin', () => {
  it('picks top-right for an item in the right half', () => {
    expect(getTransformOrigin(300, 100, 400)).toBe('top-right');
  });

  it('picks top-left for an item in the left half', () => {
    expect(getTransformOrigin(40, 100, 400)).toBe('top-left');
  });

  it('picks top-center within the tolerance of the exact centre', () => {
    // Item centred at 200 — midpoint 200, exactly the window centre.
    expect(getTransformOrigin(150, 100, 400)).toBe('top-center');
    // A hair off-centre (4 px) still lands within the 10 px tolerance.
    expect(getTransformOrigin(154, 100, 400)).toBe('top-center');
    // 20 px off-centre is outside the tolerance.
    expect(getTransformOrigin(160, 100, 400)).toBe('top-right');
  });

  it('uses the bottom variants when bottom is requested', () => {
    expect(getTransformOrigin(300, 100, 400, true)).toBe('bottom-right');
    expect(getTransformOrigin(40, 100, 400, true)).toBe('bottom-left');
    expect(getTransformOrigin(150, 100, 400, true)).toBe('bottom-center');
  });
});

describe('menuAnimationAnchor', () => {
  const ITEM_WIDTH = 200;
  const MENU_HEIGHT = 122;
  const MENU_WIDTH = 240;

  it('left anchor: begins off the left edge, ends over the right edge — upstream verbatim', () => {
    const result = menuAnimationAnchor('top-left', ITEM_WIDTH, MENU_HEIGHT, MENU_WIDTH);
    expect(result.beginningTransformations).toEqual({ translateX: -120, translateY: -61 });
    expect(result.endingTransformations).toEqual({ translateX: 120, translateY: 61 });
  });

  it('right anchor: begins off the right edge, ends over the left edge — upstream verbatim', () => {
    const result = menuAnimationAnchor('top-right', ITEM_WIDTH, MENU_HEIGHT, MENU_WIDTH);
    expect(result.beginningTransformations).toEqual({ translateX: 120, translateY: -61 });
    expect(result.endingTransformations).toEqual({ translateX: -120, translateY: 61 });
  });

  it('top-center anchor: begins at the item width, ends at rest', () => {
    const result = menuAnimationAnchor('top-center', ITEM_WIDTH, MENU_HEIGHT, MENU_WIDTH);
    expect(result.beginningTransformations).toEqual({ translateX: 200, translateY: -61 });
    expect(result.endingTransformations).toEqual({ translateX: 0, translateY: 61 });
  });

  it('bottom anchors flip the ending vertical travel', () => {
    const result = menuAnimationAnchor('bottom-left', ITEM_WIDTH, MENU_HEIGHT, MENU_WIDTH);
    expect(result.beginningTransformations).toEqual({ translateX: -120, translateY: -61 });
    expect(result.endingTransformations).toEqual({ translateX: 120, translateY: -61 });
  });
});

describe('leftOrRight', () => {
  const ITEM_WIDTH = 200;
  const MENU_WIDTH = 240;

  it('left anchor aligns the panel to the item left edge', () => {
    expect(leftOrRight('top-left', ITEM_WIDTH, MENU_WIDTH)).toBe(0);
  });

  it('right anchor aligns the panel right edge to the item right edge', () => {
    expect(leftOrRight('top-right', ITEM_WIDTH, MENU_WIDTH)).toBe(-MENU_WIDTH + ITEM_WIDTH);
  });

  it("centre anchor uses upstream's verbatim formula", () => {
    expect(leftOrRight('top-center', ITEM_WIDTH, MENU_WIDTH)).toBe(-(ITEM_WIDTH + MENU_WIDTH) / 2);
  });
});

describe('resolveHoldMenuTravel / calculateTransformValue', () => {
  /** A 122 px menu under a 60 px item sitting 100 px down the viewport. */
  const base = {
    itemY: 100,
    itemHeight: 60,
    menuHeight: 122,
    disableMove: false,
    opensBelow: true,
    windowHeight: VIEWPORT.height,
    safeTop: NO_INSETS.top,
    safeBottom: NO_INSETS.bottom,
  };

  it('returns zero travel when the menu fits below the item', () => {
    // Room below = 800 - 8 - (100 + 60 + 8) = 624 > 122.
    const travel = resolveHoldMenuTravel(base);
    expect(travel.tY).toBe(0);
    expect(travel.maxHeight).toBe(624);
  });

  it('travels up (negative tY) on overflow below', () => {
    // Item near the bottom: room below = 800 - 8 - (700 + 60 + 8) = 24, overflow 98.
    const travel = resolveHoldMenuTravel({ ...base, itemY: 700 });
    expect(travel.tY).toBe(-98);
    // The panel may occupy the original room plus the travel.
    expect(travel.maxHeight).toBe(24 + 98);
  });

  it('clamps travel so the item top never leaves the safe area', () => {
    // Safe top of 47 (+ 8 margin): the item at y = 100 may travel up at most
    // 45 px before its top touches the safe area, so the 176 px overflow is
    // clamped to 45 and the residual comes off the panel's maxHeight.
    const travel = resolveHoldMenuTravel({ ...base, itemY: 100, safeTop: 47, menuHeight: 800 });
    expect(travel.tY).toBe(-45);
    expect(travel.maxHeight).toBe(624 + 45);
  });

  it('refuses travel entirely for an item already above the safe area', () => {
    // The item top (y = 40) is already above the safe area (47 + 8 margin),
    // so no up-travel is allowed at all.
    const travel = resolveHoldMenuTravel({ ...base, itemY: 40, safeTop: 47, menuHeight: 800 });
    expect(travel.tY).toBe(0);
    expect(travel.maxHeight).toBe(684);
  });

  it('disableMove always pins the item and caps the panel to the room', () => {
    const travel = resolveHoldMenuTravel({ ...base, itemY: 700, disableMove: true });
    expect(travel.tY).toBe(0);
    expect(travel.maxHeight).toBe(24);
  });

  it('travels down (positive tY) when the menu runs off the top for bottom anchors', () => {
    // Item at the very top: room above = 20 - 8 - 0 - 8 = 4, overflow 118.
    const travel = resolveHoldMenuTravel({ ...base, itemY: 20, opensBelow: false });
    expect(travel.tY).toBe(118);
  });

  it('clamps downward travel so the item bottom never leaves the safe area', () => {
    // Bound = 800 - 0 - 8 - (60 + 60) = 672; wanted 118 → 118 fits, so pick a
    // taller menu to force the clamp: menu 800 → overflow 796, bound 672.
    const travel = resolveHoldMenuTravel({ ...base, itemY: 60, opensBelow: false, menuHeight: 800 });
    expect(travel.tY).toBe(672);
  });

  it('calculateTransformValue is the tY half of the travel resolution', () => {
    expect(calculateTransformValue({ ...base, itemY: 700 })).toBe(-98);
    expect(calculateTransformValue({ ...base, itemY: 700, disableMove: true })).toBe(0);
  });

  it('subtracts real device insets rather than assuming zero', () => {
    // Phone: room below = 844 - 34 - 8 - (300 + 60 + 8) = 434.
    const travel = resolveHoldMenuTravel({
      itemY: 300,
      itemHeight: 60,
      menuHeight: 122,
      disableMove: false,
      opensBelow: true,
      windowHeight: PHONE.height,
      safeTop: PHONE_INSETS.top,
      safeBottom: PHONE_INSETS.bottom,
    });
    expect(travel.tY).toBe(0);
    expect(travel.maxHeight).toBe(434);
  });
});

describe('menuMaxHeight / menuPanelHeight', () => {
  it('menuMaxHeight is the scroll cap after travel', () => {
    expect(
      menuMaxHeight({
        itemY: 700,
        itemHeight: 60,
        menuHeight: 122,
        disableMove: false,
        opensBelow: true,
        windowHeight: 800,
        safeTop: 0,
        safeBottom: 0,
      }),
    ).toBe(122);
  });

  it('menuPanelHeight caps the estimate to the room and never below one row', () => {
    expect(menuPanelHeight(122, 122)).toBe(122);
    expect(menuPanelHeight(800, 100)).toBe(100);
    expect(menuPanelHeight(800, 10)).toBe(40); // one row floor
  });
});

describe('clampMenuLeft', () => {
  it('clamps a left overhang into the safe viewport', () => {
    expect(clampMenuLeft({ left: -50, menuWidth: 240, windowWidth: 400, safeLeft: 0, safeRight: 0 })).toBe(8);
  });

  it('clamps a right overhang into the safe viewport', () => {
    expect(clampMenuLeft({ left: 300, menuWidth: 240, windowWidth: 400, safeLeft: 0, safeRight: 0 })).toBe(152);
  });

  it('leaves an already-inside panel alone', () => {
    expect(clampMenuLeft({ left: 80, menuWidth: 240, windowWidth: 400, safeLeft: 0, safeRight: 0 })).toBe(80);
  });

  it('honours the safe-area insets', () => {
    expect(clampMenuLeft({ left: -50, menuWidth: 240, windowWidth: 390, safeLeft: 10, safeRight: 10 })).toBe(18);
    expect(clampMenuLeft({ left: 300, menuWidth: 240, windowWidth: 390, safeLeft: 10, safeRight: 10 })).toBe(132);
  });
});
