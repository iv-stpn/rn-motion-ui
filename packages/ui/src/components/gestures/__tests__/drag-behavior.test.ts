import { describe, expect, it } from 'vitest';
import { DRAG_TUNING_DEFAULTS, type DragBehavior, resolveDragBehavior } from '../drag-behavior';

describe('DRAG_TUNING_DEFAULTS', () => {
  it('holds on touch platforms and not on pointer ones', () => {
    expect(DRAG_TUNING_DEFAULTS.ios.holdDelay).toBe(300);
    expect(DRAG_TUNING_DEFAULTS.android.holdDelay).toBe(300);
    expect(DRAG_TUNING_DEFAULTS.web.holdDelay).toBeNull();
    expect(DRAG_TUNING_DEFAULTS.macos.holdDelay).toBeNull();
    expect(DRAG_TUNING_DEFAULTS.windows.holdDelay).toBeNull();
  });

  it('keeps the arm window everywhere, including web', () => {
    // Web touch still shares the surface with the page's scroll, so dropping the
    // arm window there would hijack swipes in a mobile browser.
    for (const tuning of Object.values(DRAG_TUNING_DEFAULTS)) expect(tuning.armDelay).toBe(150);
  });

  it('gives Android the tighter slop the platform itself uses', () => {
    expect(DRAG_TUNING_DEFAULTS.android.slop).toBeLessThan(DRAG_TUNING_DEFAULTS.ios.slop);
  });

  it('sets the escape bar above the ordinary slop wherever a hold can fire', () => {
    // Otherwise the drift of a resting hand would escape the menu it just opened.
    expect(DRAG_TUNING_DEFAULTS.ios.escapeSlop).toBeGreaterThan(DRAG_TUNING_DEFAULTS.ios.slop);
    expect(DRAG_TUNING_DEFAULTS.android.escapeSlop).toBeGreaterThan(DRAG_TUNING_DEFAULTS.android.slop);
  });
});

describe('resolveDragBehavior', () => {
  it('returns the platform default with no behavior at all', () => {
    expect(resolveDragBehavior(undefined, 'ios')).toEqual(DRAG_TUNING_DEFAULTS.ios);
    expect(resolveDragBehavior({}, 'android')).toEqual(DRAG_TUNING_DEFAULTS.android);
  });

  it('applies a flat field on every platform', () => {
    expect(resolveDragBehavior({ armDelay: 0 }, 'ios').armDelay).toBe(0);
    expect(resolveDragBehavior({ armDelay: 0 }, 'web').armDelay).toBe(0);
  });

  it('leaves the fields a behavior does not name at their defaults', () => {
    const resolved = resolveDragBehavior({ slop: 20 }, 'ios');
    expect(resolved.slop).toBe(20);
    expect(resolved.armDelay).toBe(DRAG_TUNING_DEFAULTS.ios.armDelay);
    expect(resolved.holdDelay).toBe(DRAG_TUNING_DEFAULTS.ios.holdDelay);
    expect(resolved.escapeSlop).toBe(DRAG_TUNING_DEFAULTS.ios.escapeSlop);
  });

  it('scopes a per-OS block to that OS', () => {
    const behavior: DragBehavior = { android: { slop: 12 } };
    expect(resolveDragBehavior(behavior, 'android').slop).toBe(12);
    expect(resolveDragBehavior(behavior, 'ios').slop).toBe(DRAG_TUNING_DEFAULTS.ios.slop);
  });

  it('applies native to every platform except web', () => {
    const behavior: DragBehavior = { native: { holdDelay: 500 } };
    expect(resolveDragBehavior(behavior, 'ios').holdDelay).toBe(500);
    expect(resolveDragBehavior(behavior, 'android').holdDelay).toBe(500);
    expect(resolveDragBehavior(behavior, 'macos').holdDelay).toBe(500);
    expect(resolveDragBehavior(behavior, 'windows').holdDelay).toBe(500);
    expect(resolveDragBehavior(behavior, 'web').holdDelay).toBeNull();
  });

  it('lets the OS block win over native, and native over the flat field', () => {
    const behavior: DragBehavior = { android: { slop: 3 }, native: { slop: 2 }, slop: 1 };
    expect(resolveDragBehavior(behavior, 'android').slop).toBe(3);
    expect(resolveDragBehavior(behavior, 'ios').slop).toBe(2);
    expect(resolveDragBehavior(behavior, 'web').slop).toBe(1);
  });

  it('turns a hold on for web, which is the whole point of the override', () => {
    // The default is `null` there; opting back in is one block.
    expect(resolveDragBehavior({ web: { holdDelay: 300 } }, 'web').holdDelay).toBe(300);
  });

  it('carries an explicit null through the merge rather than reading it as absent', () => {
    // `??` would let the platform default win here, which would re-enable a hold the
    // consumer just turned off.
    expect(resolveDragBehavior({ holdDelay: null }, 'ios').holdDelay).toBeNull();
    expect(resolveDragBehavior({ ios: { holdDelay: null } }, 'ios').holdDelay).toBeNull();
    expect(resolveDragBehavior({ holdDelay: 400, native: { holdDelay: null } }, 'android').holdDelay).toBeNull();
  });

  it('accepts a zero, which a truthiness check would drop', () => {
    expect(resolveDragBehavior({ armDelay: 0, slop: 0 }, 'ios')).toMatchObject({ armDelay: 0, slop: 0 });
  });

  it('does not mutate the defaults it merges onto', () => {
    resolveDragBehavior({ native: { armDelay: 999 }, slop: 999 }, 'ios');
    expect(DRAG_TUNING_DEFAULTS.ios).toEqual({ armDelay: 150, escapeSlop: 24, holdDelay: 300, slop: 10 });
  });

  it('ignores a per-OS block that is not this platform, even a contradictory one', () => {
    const behavior: DragBehavior = { ios: { armDelay: 0, escapeSlop: 0, holdDelay: null, slop: 0 } };
    expect(resolveDragBehavior(behavior, 'android')).toEqual(DRAG_TUNING_DEFAULTS.android);
  });
});
