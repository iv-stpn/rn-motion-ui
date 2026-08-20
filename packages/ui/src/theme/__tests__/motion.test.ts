import { describe, expect, it } from 'vitest';
import {
  MENU_ENTER_OFFSET,
  MENU_ENTER_SCALE,
  MENU_EXIT_TRANSITION,
  MOTION_MENU_ENTER,
  menuTransformOrigin,
  resolveMenuMotion,
  TIMING_FAST,
} from '../motion';

describe('resolveMenuMotion', () => {
  it('enters from above and settles at rest when the panel opens below the trigger', () => {
    const motion = resolveMenuMotion({ reduce: false, side: 'bottom' });

    expect(motion.from).toEqual({ opacity: 0, scale: MENU_ENTER_SCALE, translateY: -MENU_ENTER_OFFSET });
    expect(motion.animate).toEqual({ opacity: 1, scale: 1, translateY: 0 });
  });

  it('enters from below when the panel opens above the trigger, so it still travels toward it', () => {
    const motion = resolveMenuMotion({ reduce: false, side: 'top' });

    expect(motion.from.translateY).toBe(MENU_ENTER_OFFSET);
  });

  it('leaves the way it arrived — one pose serves both ends', () => {
    const motion = resolveMenuMotion({ reduce: false, side: 'bottom' });

    expect(motion.exit).toEqual(motion.from);
  });

  it('springs in and tweens out by default', () => {
    const motion = resolveMenuMotion({ reduce: false, side: 'bottom' });

    expect(motion.transition).toEqual(MOTION_MENU_ENTER);
    expect(motion.exitTransition).toEqual(MENU_EXIT_TRANSITION);
  });

  it('applies the slide on top of a resting offset rather than replacing it', () => {
    // An anchored panel rests at `layout.shift` — the travel that keeps the held
    // item and the panel on screen together. The slide is added to it.
    const motion = resolveMenuMotion({ reduce: false, restingTranslateY: -120, side: 'bottom' });

    expect(motion.from.translateY).toBe(-120 - MENU_ENTER_OFFSET);
    expect(motion.animate.translateY).toBe(-120);
  });

  describe('reduced motion', () => {
    it('cross-fades in place — no scale, no travel', () => {
      const motion = resolveMenuMotion({ reduce: true, side: 'bottom' });

      expect(motion.from).toEqual({ opacity: 0, scale: 1, translateY: 0 });
      expect(motion.transition).toEqual(TIMING_FAST);
      expect(motion.exitTransition).toEqual(TIMING_FAST);
    });

    it('still settles at a resting offset, since that is placement rather than motion', () => {
      const motion = resolveMenuMotion({ reduce: true, restingTranslateY: -120, side: 'bottom' });

      expect(motion.from.translateY).toBe(-120);
      expect(motion.animate.translateY).toBe(-120);
    });

    it('wins over a consumer override — asking for less movement is not asking for less feedback', () => {
      const motion = resolveMenuMotion({
        motion: { enter: { damping: 5 }, offset: 64, scale: 0.2 },
        reduce: true,
        side: 'bottom',
      });

      expect(motion.from).toEqual({ opacity: 0, scale: 1, translateY: 0 });
      expect(motion.transition).toEqual(TIMING_FAST);
    });
  });

  describe('overrides', () => {
    it('takes a scale and an offset without restating the rest of the preset', () => {
      const motion = resolveMenuMotion({ motion: { offset: 24, scale: 0.6 }, reduce: false, side: 'bottom' });

      expect(motion.from).toEqual({ opacity: 0, scale: 0.6, translateY: -24 });
      expect(motion.transition).toEqual(MOTION_MENU_ENTER);
    });

    it('disables the scale at 1 and the slide at 0, leaving a plain fade', () => {
      const motion = resolveMenuMotion({ motion: { offset: 0, scale: 1 }, reduce: false, side: 'bottom' });

      expect(motion.from).toEqual({ opacity: 0, scale: 1, translateY: 0 });
    });

    it('merges one spring field into the enter preset and leaves the others alone', () => {
      const motion = resolveMenuMotion({ motion: { enter: { stiffness: 900 } }, reduce: false, side: 'bottom' });

      expect(motion.transition).toEqual({ ...MOTION_MENU_ENTER, stiffness: 900 });
    });

    it('swaps the enter spring for a tween when the override changes its type', () => {
      const motion = resolveMenuMotion({
        motion: { enter: { duration: 90, type: 'timing' } },
        reduce: false,
        side: 'bottom',
      });

      expect(motion.transition).toMatchObject({ duration: 90, type: 'timing' });
    });

    it('overrides enter and exit independently', () => {
      const motion = resolveMenuMotion({
        motion: { enter: { stiffness: 900 }, exit: { duration: 40 } },
        reduce: false,
        side: 'bottom',
      });

      expect(motion.transition).toEqual({ ...MOTION_MENU_ENTER, stiffness: 900 });
      expect(motion.exitTransition).toEqual({ ...MENU_EXIT_TRANSITION, duration: 40 });
    });
  });
});

describe('menuTransformOrigin', () => {
  it('grows down from its own top edge when the panel opens below the trigger', () => {
    expect(menuTransformOrigin({ align: 'start', side: 'bottom' })).toBe('left top');
    expect(menuTransformOrigin({ align: 'center', side: 'bottom' })).toBe('center top');
    expect(menuTransformOrigin({ align: 'end', side: 'bottom' })).toBe('right top');
  });

  it('grows up from its own bottom edge when the panel opens above the trigger', () => {
    expect(menuTransformOrigin({ align: 'start', side: 'top' })).toBe('left bottom');
    expect(menuTransformOrigin({ align: 'center', side: 'top' })).toBe('center bottom');
    expect(menuTransformOrigin({ align: 'end', side: 'top' })).toBe('right bottom');
  });
});
