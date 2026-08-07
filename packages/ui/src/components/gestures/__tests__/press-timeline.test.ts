import { describe, expect, it } from 'vitest';
import { DRAG_TUNING_DEFAULTS, type DragBehavior, HOLD_TUNING_DEFAULTS, resolveHoldBehavior } from '../drag-behavior';
import { isPressTracking, type PressPhase, readPressMove } from '../press-timeline';

/** iOS's numbers, which are the ones every threshold assertion below is written against. */
const THRESHOLDS = { escapeSlop: 24, slop: 10 };

function move(phase: PressPhase, travel: number, canDrag = true) {
  return readPressMove({ canDrag, phase, thresholds: THRESHOLDS, travel });
}

describe('readPressMove', () => {
  it('gives the gesture up when the finger travels before the press commits', () => {
    // The whole point of the arm window: a list stays scrollable because a finger
    // that starts moving straight away is panning the surface, not picking up.
    expect(move('pending', 11)).toBe('scrolled');
    expect(move('pending', 10)).toBe('ignore');
  });

  it('gives it up before the press commits even with nothing to drag', () => {
    expect(move('pending', 11, false)).toBe('scrolled');
  });

  it('lifts a drag once the press has committed', () => {
    expect(move('active', 11)).toBe('lift');
    expect(move('active', 10)).toBe('ignore');
  });

  it('ends the press instead of lifting when there is nothing to drag', () => {
    // A `<Holdable>`: the same shove that would lift a drag is a shove off it.
    expect(move('active', 11, false)).toBe('scrolled');
  });

  it('raises the bar once the hold has fired', () => {
    // Something the hold put on screen is under the finger now, so escaping takes a
    // deliberate shove rather than the drift of a hand that thought it had finished.
    expect(move('hold', 20)).toBe('ignore');
    expect(move('hold', 25)).toBe('lift');
  });

  it('keeps the press on a hold with nothing to escape to, however far it travels', () => {
    // What makes a held menu stay open under a resting thumb on a `<Holdable>`.
    expect(move('hold', 999, false)).toBe('ignore');
  });

  it('ignores a move once the drag owns it, and when nothing is tracking', () => {
    expect(move('drag', 999)).toBe('ignore');
    expect(move('idle', 999)).toBe('ignore');
  });

  it('treats a zero slop as "any travel at all", which a truthiness check would drop', () => {
    expect(readPressMove({ canDrag: true, phase: 'active', thresholds: { escapeSlop: 0, slop: 0 }, travel: 1 })).toBe('lift');
    expect(readPressMove({ canDrag: true, phase: 'active', thresholds: { escapeSlop: 0, slop: 0 }, travel: 0 })).toBe('ignore');
  });
});

describe('isPressTracking', () => {
  it('is true for every phase the finger is still down for', () => {
    expect(isPressTracking('idle')).toBe(false);
    for (const phase of ['pending', 'active', 'hold', 'drag'] as const) expect(isPressTracking(phase)).toBe(true);
  });
});

describe('HOLD_TUNING_DEFAULTS', () => {
  it('holds on every platform, unlike a bare drag', () => {
    // A component named for the hold that never holds is not a default.
    for (const tuning of Object.values(HOLD_TUNING_DEFAULTS)) expect(tuning.holdDelay).toBe(300);
    expect(DRAG_TUNING_DEFAULTS.web.holdDelay).toBeNull();
  });

  it('changes nothing else — the touch platforms are the drag defaults exactly', () => {
    expect(HOLD_TUNING_DEFAULTS.ios).toEqual(DRAG_TUNING_DEFAULTS.ios);
    expect(HOLD_TUNING_DEFAULTS.android).toEqual(DRAG_TUNING_DEFAULTS.android);
  });

  it('keeps the desktop slops where the drag defaults put them', () => {
    expect(HOLD_TUNING_DEFAULTS.web).toMatchObject({ armDelay: 150, escapeSlop: 24, slop: 10 });
  });
});

describe('resolveHoldBehavior', () => {
  it('returns the hold default with no behavior at all', () => {
    expect(resolveHoldBehavior(undefined, 'web')).toEqual(HOLD_TUNING_DEFAULTS.web);
    expect(resolveHoldBehavior({}, 'ios')).toEqual(HOLD_TUNING_DEFAULTS.ios);
  });

  it('applies the same merge order the drag resolver does', () => {
    const behavior: DragBehavior = { android: { slop: 3 }, native: { slop: 2 }, slop: 1 };
    expect(resolveHoldBehavior(behavior, 'android').slop).toBe(3);
    expect(resolveHoldBehavior(behavior, 'ios').slop).toBe(2);
    expect(resolveHoldBehavior(behavior, 'web').slop).toBe(1);
  });

  it('lets a consumer turn the hold off, including on the platforms it defaults on', () => {
    expect(resolveHoldBehavior({ holdDelay: null }, 'web').holdDelay).toBeNull();
    expect(resolveHoldBehavior({ web: { holdDelay: null } }, 'web').holdDelay).toBeNull();
  });

  it('takes the 100ms arm window a consumer asks for, on every platform', () => {
    for (const os of ['android', 'ios', 'macos', 'web', 'windows'] as const)
      expect(resolveHoldBehavior({ armDelay: 100 }, os).armDelay).toBe(100);
  });

  it('does not mutate the defaults it merges onto', () => {
    resolveHoldBehavior({ native: { armDelay: 999 }, slop: 999 }, 'ios');
    expect(HOLD_TUNING_DEFAULTS.ios).toEqual({ armDelay: 150, escapeSlop: 24, holdDelay: 300, slop: 10 });
    expect(HOLD_TUNING_DEFAULTS.web).toEqual({ armDelay: 150, escapeSlop: 24, holdDelay: 300, slop: 10 });
  });
});
