import { describe, expect, it } from 'vitest';
import { PRESS_SCALE_DOWN, PRESS_SCALE_UP, pressAnimate } from '../button-press';

// The press-scale resolution is the pure half of the button family's tap
// interaction (see button-press.ts), split out so it can be driven here without
// importing the .tsx machinery. The two uniform modes are directional — `scaleUp`
// grows the button, `scaleDown` shrinks it — and each settles to its own default
// unless a `pressScale` is passed. The axis-compression modes (`scaleY` /
// `scaleX*`) are left as they were; they only matter to segmented controls.

describe('pressAnimate — uniform direction modes', () => {
  it('scaleUp grows the button to its default when pressed', () => {
    expect(pressAnimate({ pressed: true, blocked: false, pressMode: 'scaleUp' })).toStrictEqual({ scale: PRESS_SCALE_UP });
    expect(PRESS_SCALE_UP).toBeGreaterThan(1);
  });

  it('scaleDown shrinks the button to its default when pressed', () => {
    expect(pressAnimate({ pressed: true, blocked: false, pressMode: 'scaleDown' })).toStrictEqual({
      scale: PRESS_SCALE_DOWN,
    });
    expect(PRESS_SCALE_DOWN).toBeLessThan(1);
  });

  it('an explicit pressScale overrides the mode default in either direction', () => {
    expect(pressAnimate({ pressed: true, blocked: false, pressMode: 'scaleUp', pressScale: 1.2 })).toStrictEqual({
      scale: 1.2,
    });
    expect(pressAnimate({ pressed: true, blocked: false, pressMode: 'scaleDown', pressScale: 0.85 })).toStrictEqual({
      scale: 0.85,
    });
  });

  it.each(['scaleUp', 'scaleDown'] as const)('%s returns to rest (scale 1) when not pressed', (pressMode) => {
    expect(pressAnimate({ pressed: false, blocked: false, pressMode })).toStrictEqual({ scale: 1 });
  });
});

describe('pressAnimate — blocking and none', () => {
  it('holds the button at rest when blocked', () => {
    expect(pressAnimate({ pressed: true, blocked: true, pressMode: 'scaleUp' })).toStrictEqual({ scale: 1 });
  });

  it('holds the button at rest for the none mode', () => {
    expect(pressAnimate({ pressed: true, blocked: false, pressMode: 'none' })).toStrictEqual({ scale: 1 });
    expect(pressAnimate({ pressed: false, blocked: false, pressMode: 'none' })).toStrictEqual({ scale: 1 });
  });
});

describe('pressAnimate — axis-compression modes (segmented controls)', () => {
  it('keeps the vertical squeeze for scaleY', () => {
    expect(pressAnimate({ pressed: true, blocked: false, pressMode: 'scaleY' })).toStrictEqual({ scaleY: 0.96, translateY: 2 });
    expect(pressAnimate({ pressed: false, blocked: false, pressMode: 'scaleY' })).toStrictEqual({ scaleY: 1, translateY: 0 });
  });

  it('keeps the horizontal squeeze for scaleX and its nudge variants', () => {
    expect(pressAnimate({ pressed: true, blocked: false, pressMode: 'scaleX' })).toStrictEqual({ scaleX: 0.96 });
    expect(pressAnimate({ pressed: true, blocked: false, pressMode: 'scaleXFirst' })).toStrictEqual({
      scaleX: 0.96,
      translateY: -1,
    });
    expect(pressAnimate({ pressed: true, blocked: false, pressMode: 'scaleXLast' })).toStrictEqual({
      scaleX: 0.96,
      translateY: 1,
    });
  });
});
