import { describe, expect, it } from 'vitest';
import { DRAG_TUNING_DEFAULTS, type DragBehavior, HOLD_TUNING_DEFAULTS, resolveHoldBehavior } from '../drag-behavior';
import { isPressTracking, type PressPhase, type PressState, readPressMove, transition } from '../press-timeline';

/** iOS's numbers, which are the ones every threshold assertion below is written against. */
const THRESHOLDS = { escapeSlop: 24, slop: 10 };

function move(phase: PressPhase, travel: number, canDrag = true) {
  return readPressMove({ canDrag, phase, thresholds: THRESHOLDS, travel });
}

/** A machine state in one line, so the assertions below read as the transitions they are. */
function machine(phase: PressPhase, hasHeld = false): PressState {
  return { phase, hasHeld };
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

describe('transition', () => {
  it('runs the whole happy path: press, arm, hold, lift, end', () => {
    let s = transition(machine('idle'), { type: 'PRESS' });
    expect(s).toEqual({ phase: 'pending', hasHeld: false });
    s = transition(s, { type: 'ARM' });
    expect(s).toEqual({ phase: 'active', hasHeld: false });
    s = transition(s, { type: 'HOLD' });
    expect(s).toEqual({ phase: 'hold', hasHeld: true });
    s = transition(s, { type: 'LIFT' });
    expect(s).toEqual({ phase: 'drag', hasHeld: false });
    s = transition(s, { type: 'END' });
    expect(s).toEqual({ phase: 'idle', hasHeld: false });
  });

  it('only a new press forgets a hold that already fired', () => {
    // The three different verbs: end keeps it, lift consumes it, press resets it.
    const held = machine('idle', true);
    expect(transition(held, { type: 'END' }).hasHeld).toBe(true);
    expect(transition(held, { type: 'LIFT' }).hasHeld).toBe(false);
    expect(transition(held, { type: 'PRESS' }).hasHeld).toBe(false);
  });

  it('treats a late arm as a no-op, whatever else has happened', () => {
    expect(transition(machine('active'), { type: 'ARM' })).toEqual(machine('active'));
    expect(transition(machine('hold', true), { type: 'ARM' })).toEqual(machine('hold', true));
    expect(transition(machine('drag'), { type: 'ARM' })).toEqual(machine('drag'));
    expect(transition(machine('idle'), { type: 'ARM' })).toEqual(machine('idle'));
  });

  it('treats a late hold as a no-op, so a hold cannot double-fire', () => {
    expect(transition(machine('pending'), { type: 'HOLD' })).toEqual(machine('pending'));
    expect(transition(machine('hold', true), { type: 'HOLD' })).toEqual(machine('hold', true));
    expect(transition(machine('drag'), { type: 'HOLD' })).toEqual(machine('drag'));
  });

  it('keeps hasHeld through an end, so a later lift can still report the escape', () => {
    // A hold fired, then a finger of several lifted (end), then a drag took it (lift):
    // the caller reads `previous.hasHeld` on that lift, which `end` must not clear.
    const afterHold = transition(machine('active'), { type: 'HOLD' });
    expect(transition(afterHold, { type: 'END' })).toEqual({ phase: 'idle', hasHeld: true });
  });

  it('consumes hasHeld on lift, so the escape cannot report twice', () => {
    const afterHold = transition(machine('active'), { type: 'HOLD' });
    const afterLift = transition(afterHold, { type: 'LIFT' });
    expect(afterLift).toEqual({ phase: 'drag', hasHeld: false });
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
