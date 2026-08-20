import { describe, expect, it } from 'vitest';
import {
  estimateHoldMenuHeight,
  HOLD_MENU_BORDER_HEIGHT,
  HOLD_MENU_DEFAULT_WIDTH,
  HOLD_MENU_GAP,
  HOLD_MENU_HEADING_HEIGHT,
  HOLD_MENU_LIST_PADDING,
  HOLD_MENU_MIN_PANEL_HEIGHT,
  HOLD_MENU_ROW_HEIGHT,
  HOLD_MENU_SEPARATOR_HEIGHT,
  HOLD_MENU_VIEWPORT_PADDING,
  type HoldMenuLayoutInput,
  resolveHoldMenuLayout,
} from '../menu-placement';

/** Square viewport, no insets — every expectation below is arithmetic on round numbers. */
const VIEWPORT = { width: 400, height: 800 };
const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 };

/** A real device, to check the insets are actually subtracted rather than assumed zero. */
const PHONE = { width: 390, height: 844 };
const PHONE_INSETS = { top: 47, bottom: 34, left: 0, right: 0 };

/**
 * The default menu in these tests: three plain action rows, plus the two things
 * the panel costs whatever it holds — its border and the list's vertical inset.
 */
const THREE_ROWS = HOLD_MENU_BORDER_HEIGHT + HOLD_MENU_LIST_PADDING + HOLD_MENU_ROW_HEIGHT * 3;

/** Bottom edge of the safe viewport, where a panel or item is allowed to end. */
const SAFE_BOTTOM = VIEWPORT.height - HOLD_MENU_VIEWPORT_PADDING;

type LayoutOverrides = Partial<HoldMenuLayoutInput> & Pick<HoldMenuLayoutInput, 'item'>;

/** `resolveHoldMenuLayout` on the plain viewport, with a three-row menu by default. */
function layout(overrides: LayoutOverrides) {
  return resolveHoldMenuLayout({
    insets: NO_INSETS,
    menuHeight: THREE_ROWS,
    menuWidth: HOLD_MENU_DEFAULT_WIDTH,
    viewport: VIEWPORT,
    ...overrides,
  });
}

describe('estimateHoldMenuHeight', () => {
  it('is zero for no items, so an empty menu is never placed', () => {
    expect(estimateHoldMenuHeight([])).toBe(0);
  });

  it('counts one row per item, plus the panel border and the list inset', () => {
    expect(estimateHoldMenuHeight([{}, {}, {}])).toBe(THREE_ROWS);
  });

  it('counts the border and the inset once, not per row', () => {
    const fixed = HOLD_MENU_BORDER_HEIGHT + HOLD_MENU_LIST_PADDING;
    expect(estimateHoldMenuHeight([{}])).toBe(fixed + HOLD_MENU_ROW_HEIGHT);
    expect(estimateHoldMenuHeight([{}, {}])).toBe(fixed + HOLD_MENU_ROW_HEIGHT * 2);
  });

  it('gives a heading its own shorter height', () => {
    const withHeading = estimateHoldMenuHeight([{ heading: true }, {}, {}]);
    expect(withHeading).toBe(THREE_ROWS - HOLD_MENU_ROW_HEIGHT + HOLD_MENU_HEADING_HEIGHT);
  });

  it('adds a separator band between groups', () => {
    expect(estimateHoldMenuHeight([{}, { separator: true }, {}])).toBe(THREE_ROWS + HOLD_MENU_SEPARATOR_HEIGHT);
  });

  it('ignores a separator on the last item, which has nothing to separate from', () => {
    expect(estimateHoldMenuHeight([{}, {}, { separator: true }])).toBe(THREE_ROWS);
  });
});

describe('resolveHoldMenuLayout — side', () => {
  it('opens below when the panel fits there', () => {
    const result = layout({ item: { x: 40, y: 100, width: 200, height: 60 } });
    expect(result.side).toBe('bottom');
    // Top edge is the item's bottom plus the gap; the panel grows down from there.
    expect(result.top).toBe(100 + 60 + HOLD_MENU_GAP);
  });

  it('flips above when below cannot fit it and above has more room', () => {
    // Low enough that the three rows genuinely do not fit under it: 24px of room
    // below, 684px above.
    const result = layout({ item: { x: 40, y: 700, width: 200, height: 60 } });
    expect(result.side).toBe('top');
    // Grows up from the item, so its top edge follows its height.
    expect(result.top).toBe(700 - HOLD_MENU_GAP - THREE_ROWS);
  });

  it('stays below when neither side fits but below has more room', () => {
    // Item high on screen: 8px above, plenty below — but not the 800px asked for.
    const result = layout({ item: { x: 40, y: 24, width: 200, height: 40 }, menuHeight: 800 });
    expect(result.side).toBe('bottom');
  });

  it('honours an explicit side even when the panel has to scroll for it', () => {
    const result = layout({ item: { x: 40, y: 24, width: 200, height: 40 }, side: 'top' });
    expect(result.side).toBe('top');
  });
});

describe('resolveHoldMenuLayout — side "bottom" (the component default)', () => {
  it('travels the pair up when the menu is taller than the space below, and the panel top stays below the item', () => {
    // Item low on screen: 84px of room below it, 200px of menu.
    const result = layout({ item: { x: 40, y: 650, width: 200, height: 50 }, menuHeight: 200, side: 'bottom' });
    expect(result.side).toBe('bottom');
    // The 116px of overflow is a negative shift: the item travels up by it.
    expect(result.shift).toBe(-116);
    // The panel may use the room plus everything the travel gained — nothing scrolls.
    expect(result.maxHeight).toBe(84 + 116);
    // The pair moved together, so the panel's top still sits at the item's
    // bottom plus the gap — travel never re-anchors the panel.
    expect(result.top).toBe(650 + 50 + HOLD_MENU_GAP);
    expect(result.top + result.shift + result.maxHeight).toBe(SAFE_BOTTOM);
  });

  it('does not travel when the menu fits below', () => {
    const result = layout({ item: { x: 40, y: 100, width: 200, height: 60 }, side: 'bottom' });
    expect(result.side).toBe('bottom');
    expect(result.shift).toBe(0);
    // Untravelled, the panel is capped to the room below it — 624px here.
    expect(result.maxHeight).toBe(SAFE_BOTTOM - (100 + 60 + HOLD_MENU_GAP));
  });
});

describe('resolveHoldMenuLayout — align', () => {
  it('aligns to the start for an item in the left half', () => {
    const result = layout({ item: { x: 20, y: 100, width: 80, height: 40 } });
    expect(result.align).toBe('start');
    expect(result.left).toBe(20);
    expect(result.transformOrigin).toBe('left top');
  });

  it('aligns to the end for an item in the right half', () => {
    const result = layout({ item: { x: 300, y: 100, width: 80, height: 40 } });
    expect(result.align).toBe('end');
    // Right edges line up: item right (380) minus panel width (240).
    expect(result.left).toBe(140);
    expect(result.transformOrigin).toBe('right top');
  });

  it('centres an item whose midpoint is within the tolerance of centre', () => {
    // Midpoint 202 vs. 400 wide: 4px off centre, inside CENTER_TOLERANCE (10).
    const result = layout({ item: { x: 162, y: 100, width: 80, height: 40 } });
    expect(result.align).toBe('center');
    expect(result.transformOrigin).toBe('center top');
  });

  it('does not centre once the midpoint is past the tolerance', () => {
    // Midpoint 210: 20px off centre, so 'end' — the roomier half.
    const result = layout({ item: { x: 170, y: 100, width: 80, height: 40 } });
    expect(result.align).toBe('end');
  });

  it('reports a bottom transform origin when the panel opens above', () => {
    // Low enough that the three rows no longer fit below, so the side flips.
    const result = layout({ item: { x: 20, y: 700, width: 80, height: 60 } });
    expect(result.side).toBe('top');
    expect(result.transformOrigin).toBe('left bottom');
  });
});

describe('resolveHoldMenuLayout — travel', () => {
  it('travels the pair up by the overflow when the panel below is too tall', () => {
    const result = layout({ item: { x: 40, y: 500, width: 200, height: 60 }, menuHeight: 300, side: 'bottom' });
    // 224px of room, 300px of panel: 76px short.
    expect(result.shift).toBe(-76);
    expect(result.maxHeight).toBe(300);
    // Shifted, the panel ends exactly on the safe edge — nothing to scroll.
    expect(result.top + result.shift + result.maxHeight).toBe(SAFE_BOTTOM);
  });

  it('stops travelling up once the held item reaches the top of the safe area', () => {
    const result = layout({ item: { x: 40, y: 500, width: 200, height: 60 }, menuHeight: 800, side: 'bottom' });
    // 492px is all the item has before its own top hits the safe edge.
    expect(result.shift).toBe(-492);
    expect(500 + result.shift).toBe(HOLD_MENU_VIEWPORT_PADDING);
    // The 84px the travel could not absorb comes off the panel, which scrolls it.
    expect(result.maxHeight).toBe(716);
    expect(result.top + result.shift + result.maxHeight).toBe(SAFE_BOTTOM);
  });

  it('travels down when the panel opens above and there is not enough room there', () => {
    const result = layout({ item: { x: 40, y: 100, width: 200, height: 60 }, menuHeight: 300, side: 'top' });
    expect(result.shift).toBe(216);
    expect(result.maxHeight).toBe(300);
    // Lands on the top safe edge rather than off the top of the screen.
    expect(result.top + result.shift).toBe(HOLD_MENU_VIEWPORT_PADDING);
  });

  it('keeps a tall item fully on screen rather than pushing its far edge off', () => {
    // The item is 600px of an 800px viewport: travelling the full 216px overflow
    // would put its bottom at 916. The clamp bounds the edge it travels toward.
    const result = layout({ item: { x: 40, y: 100, width: 200, height: 600 }, menuHeight: 300, side: 'top' });
    expect(result.shift).toBe(92);
    expect(100 + result.shift + 600).toBe(SAFE_BOTTOM);
    expect(result.maxHeight).toBe(176);
    expect(result.top + result.shift).toBe(HOLD_MENU_VIEWPORT_PADDING);
  });

  it('does not travel when the panel already fits', () => {
    const result = layout({ item: { x: 40, y: 100, width: 200, height: 60 } });
    expect(result.shift).toBe(0);
  });
});

describe('resolveHoldMenuLayout — disableMove', () => {
  it('pins the item and caps the panel to the room it has', () => {
    const result = layout({
      disableMove: true,
      item: { x: 40, y: 500, width: 200, height: 60 },
      menuHeight: 300,
      side: 'bottom',
    });
    expect(result.shift).toBe(0);
    // 300px of panel in 224px of room: capped, and the panel scrolls the rest.
    expect(result.maxHeight).toBe(224);
    expect(result.top + result.maxHeight).toBe(SAFE_BOTTOM);
  });

  it('never caps below one visible row — border and list inset included', () => {
    // Item flush with the bottom edge: the space below it is negative.
    const result = layout({ disableMove: true, item: { x: 40, y: 790, width: 200, height: 10 }, side: 'bottom' });
    expect(result.maxHeight).toBe(HOLD_MENU_MIN_PANEL_HEIGHT);
    // The floor is what one row actually costs: capped to the row alone, the
    // panel's own border and the list's inset would eat into it.
    expect(HOLD_MENU_MIN_PANEL_HEIGHT).toBe(HOLD_MENU_BORDER_HEIGHT + HOLD_MENU_LIST_PADDING + HOLD_MENU_ROW_HEIGHT);
  });
});

describe('resolveHoldMenuLayout — insets', () => {
  it('treats the top inset as the ceiling the pair travels toward', () => {
    const result = resolveHoldMenuLayout({
      insets: PHONE_INSETS,
      item: { x: 40, y: 60, width: 200, height: 50 },
      menuHeight: 300,
      menuWidth: HOLD_MENU_DEFAULT_WIDTH,
      side: 'top',
      viewport: PHONE,
    });
    expect(result.top + result.shift).toBe(PHONE_INSETS.top + HOLD_MENU_VIEWPORT_PADDING);
    expect(result.maxHeight).toBe(300);
  });

  it('treats the bottom inset as the floor', () => {
    const result = resolveHoldMenuLayout({
      insets: PHONE_INSETS,
      item: { x: 40, y: 700, width: 200, height: 60 },
      menuHeight: 300,
      menuWidth: HOLD_MENU_DEFAULT_WIDTH,
      side: 'bottom',
      viewport: PHONE,
    });
    expect(result.top + result.shift + result.maxHeight).toBe(PHONE.height - PHONE_INSETS.bottom - HOLD_MENU_VIEWPORT_PADDING);
  });
});

describe('resolveHoldMenuLayout — horizontal clamping', () => {
  it('pulls an end-aligned panel back inside the left edge', () => {
    // Item right edge is 60; aligning the panel's right to it would put its left
    // at -180. Upstream lets that overhang; here it is clamped.
    const result = layout({ align: 'end', item: { x: 0, y: 100, width: 60, height: 40 } });
    expect(result.left).toBe(HOLD_MENU_VIEWPORT_PADDING);
  });

  it('pulls a start-aligned panel back inside the right edge', () => {
    const result = layout({ align: 'start', item: { x: 380, y: 100, width: 20, height: 40 } });
    expect(result.left).toBe(VIEWPORT.width - HOLD_MENU_VIEWPORT_PADDING - HOLD_MENU_DEFAULT_WIDTH);
  });

  it('clamps to the left inset rather than the raw viewport edge', () => {
    const result = layout({
      align: 'start',
      insets: { top: 0, bottom: 0, left: 40, right: 40 },
      item: { x: 0, y: 100, width: 60, height: 40 },
    });
    expect(result.left).toBe(40 + HOLD_MENU_VIEWPORT_PADDING);
  });

  it('shrinks the panel to the safe width when it is wider than the screen', () => {
    const result = layout({ item: { x: 40, y: 100, width: 200, height: 40 }, menuWidth: 1000 });
    expect(result.width).toBe(VIEWPORT.width - HOLD_MENU_VIEWPORT_PADDING * 2);
  });
});
