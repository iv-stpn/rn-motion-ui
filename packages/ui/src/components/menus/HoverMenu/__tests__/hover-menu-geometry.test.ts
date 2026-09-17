import { describe, expect, it } from 'vitest';
import type { ComputePanelLayoutOptions } from '../hover-menu-geometry';
import { computePanelLayout, DEFAULT_WIDTH, VIEWPORT_PADDING } from '../hover-menu-geometry';

/** A 800×600 viewport with a mid-screen trigger, the common case for these tests. */
const VIEWPORT = { viewportWidth: 800, viewportHeight: 600 };
const TRIGGER = { rect: { x: 100, y: 100, w: 120, h: 40 } as const };
const PANEL = { panelSize: { w: 200, h: 300 } as const };

function layout(overrides: Partial<ComputePanelLayoutOptions> = {}) {
  return computePanelLayout({
    align: 'start',
    offset: 4,
    width: 200,
    ...VIEWPORT,
    ...TRIGGER,
    ...PANEL,
    ...overrides,
  });
}

describe('computePanelLayout — measurement gate', () => {
  it('returns measured:false and a zeroed position while the trigger is unmeasured', () => {
    const result = computePanelLayout({
      rect: null,
      panelSize: { w: 200, h: 300 },
      align: 'start',
      offset: 4,
      width: 200,
      ...VIEWPORT,
    });
    expect(result).toEqual({ left: 0, top: 0, openAbove: false, panelWidth: 200, measured: false });
  });

  it('returns measured:false when the panel has not been laid out yet (zero size)', () => {
    const result = layout({ panelSize: { w: 0, h: 0 } });
    expect(result.measured).toBe(false);
  });

  it('returns measured:true once both the trigger rect and the panel size are known', () => {
    expect(layout().measured).toBe(true);
  });
});

describe('computePanelLayout — panel width', () => {
  it('uses the fixed width when width is a number, even before measurement', () => {
    expect(layout({ width: 320 }).panelWidth).toBe(320);
  });

  it("falls back to the trigger's measured width when width is 'trigger'", () => {
    expect(layout({ width: 'trigger' }).panelWidth).toBe(120);
  });

  it("falls back to DEFAULT_WIDTH when width is 'trigger' but the trigger is unmeasured", () => {
    const result = computePanelLayout({
      rect: null,
      panelSize: { w: 200, h: 300 },
      align: 'start',
      offset: 4,
      width: 'trigger',
      ...VIEWPORT,
    });
    expect(result.panelWidth).toBe(DEFAULT_WIDTH);
  });
});

describe('computePanelLayout — horizontal alignment', () => {
  it('anchors start-aligned panels to the trigger left edge', () => {
    expect(layout({ align: 'start' }).left).toBe(100);
  });

  it('anchors end-aligned panels so their right edge meets the trigger right edge', () => {
    expect(layout({ align: 'end' }).left).toBe(100 + 120 - 200);
  });

  it('clamps a start-aligned panel that would spill off the left edge', () => {
    expect(layout({ rect: { x: 0, y: 100, w: 120, h: 40 }, align: 'start' }).left).toBe(VIEWPORT_PADDING);
  });

  it('clamps an end-aligned panel that would spill off the right edge', () => {
    expect(layout({ rect: { x: 700, y: 100, w: 120, h: 40 }, align: 'end' }).left).toBe(800 - 200 - VIEWPORT_PADDING);
  });
});

describe('computePanelLayout — vertical placement', () => {
  it('opens below the trigger, offset by the gap, when there is room', () => {
    const result = layout();
    expect(result.openAbove).toBe(false);
    expect(result.top).toBe(100 + 40 + 4);
  });

  it('flips above the trigger when the panel would not fit below but would above', () => {
    const result = layout({ rect: { x: 100, y: 500, w: 120, h: 40 } });
    expect(result.openAbove).toBe(true);
    expect(result.top).toBe(500 - 4 - 300);
  });

  it('stays below when it fits neither side, preferring the larger gap', () => {
    // spaceBelow = 600 - (260 + 40) - 12 = 288, spaceAbove = 260 - 12 = 248:
    // the 300px panel fits neither (both < 300), and below offers more room than
    // above, so the flip condition (`spaceAbove > spaceBelow`) does not fire.
    const result = layout({ rect: { x: 100, y: 260, w: 120, h: 40 } });
    expect(result.openAbove).toBe(false);
  });

  it('never opens above when the panel height is unknown', () => {
    const result = layout({ rect: { x: 100, y: 500, w: 120, h: 40 }, panelSize: { w: 200, h: 0 } });
    expect(result.openAbove).toBe(false);
  });

  it('clamps a flipped panel that would rise above the viewport', () => {
    // spaceBelow = 600 - (290 + 40) - 12 = 258, spaceAbove = 290 - 12 = 278:
    // the panel flips above (278 > 258) and its rawTop = 290 - 4 - 300 = -14
    // pins to the top padding rather than rendering off-screen.
    const result = layout({ rect: { x: 100, y: 290, w: 120, h: 40 }, panelSize: { w: 200, h: 300 } });
    expect(result.openAbove).toBe(true);
    expect(result.top).toBe(VIEWPORT_PADDING);
  });

  it('clamps a panel taller than the viewport to the top padding', () => {
    // A 700px panel in a 600px viewport can never fit below; above (88px) is
    // smaller than below (448px), so it stays below and pins to maxTop = 8.
    const result = layout({ rect: { x: 100, y: 100, w: 120, h: 40 }, panelSize: { w: 200, h: 700 } });
    expect(result.openAbove).toBe(false);
    expect(result.top).toBe(VIEWPORT_PADDING);
  });
});
