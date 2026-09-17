import { describe, expect, it } from 'vitest';
import { computePaneHeight, mergeTriggerSize, opensUpward, PANE_INSET } from '../morphing-switcher-geometry';
import { SWITCHER_SCALE } from '../morphing-switcher-scale';

const MD_HEIGHT = SWITCHER_SCALE.md.height;

describe('opensUpward', () => {
  it('opens below when the pane fits under the trigger', () => {
    // spaceBelow = 800 - 100 - 40 - 8 = 652, comfortably fits a 300px pane.
    expect(opensUpward(300, 100, 40, 800)).toBe(false);
  });

  it('flips up when the pane does not fit below and there is more room above', () => {
    // Near the bottom: spaceBelow = 800 - 700 - 40 - 8 = 52, spaceAbove = 692.
    expect(opensUpward(300, 700, 40, 800)).toBe(true);
  });

  it('does not flip when the pane fits below even if it also fits above', () => {
    // Trigger at the top has abundant space below, so no flip is needed.
    expect(opensUpward(100, 10, 40, 800)).toBe(false);
  });

  it('requires strictly more room above than below to flip', () => {
    // Symmetric case: spaceBelow = spaceAbove = 372. The pane is taller than
    // either, but "above" does not beat "below", so it stays put.
    expect(opensUpward(500, 380, 40, 800)).toBe(false);
  });

  it('subtracts the viewport padding from both measurements', () => {
    // spaceBelow = 100 - 50 - 10 - 8 = 32, spaceAbove = 42.
    expect(opensUpward(33, 50, 10, 100)).toBe(true);
    expect(opensUpward(32, 50, 10, 100)).toBe(false);
  });
});

describe('computePaneHeight', () => {
  it('stacks one row per item on the trigger height plus both insets', () => {
    expect(computePaneHeight(SWITCHER_SCALE.md, 3, undefined)).toBe(MD_HEIGHT + 3 * MD_HEIGHT + PANE_INSET * 2);
  });

  it('adds the pane inset for zero items (the trigger alone)', () => {
    expect(computePaneHeight(SWITCHER_SCALE.md, 0, undefined)).toBe(MD_HEIGHT + PANE_INSET * 2);
  });

  it('honours a pinned expandedHeight over the computed stack', () => {
    expect(computePaneHeight(SWITCHER_SCALE.md, 3, 240)).toBe(240);
  });

  it('honours expandedHeight even when it is zero', () => {
    expect(computePaneHeight(SWITCHER_SCALE.md, 3, 0)).toBe(0);
  });
});

describe('mergeTriggerSize', () => {
  it('returns the size when there is no previous measurement', () => {
    expect(mergeTriggerSize(null, { width: 200, height: 40 })).toEqual({ width: 200, height: 40 });
  });

  it('returns the previous object unchanged when the dimensions match', () => {
    const prev = { width: 200, height: 40 };
    expect(mergeTriggerSize(prev, { width: 200, height: 40 })).toBe(prev);
  });

  it('returns the new size when the width changes', () => {
    const prev = { width: 200, height: 40 };
    expect(mergeTriggerSize(prev, { width: 220, height: 40 })).toEqual({ width: 220, height: 40 });
  });

  it('returns the new size when the height changes', () => {
    const prev = { width: 200, height: 40 };
    expect(mergeTriggerSize(prev, { width: 200, height: 44 })).toEqual({ width: 200, height: 44 });
  });
});
