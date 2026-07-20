import { describe, expect, it } from 'vitest';
import { animationConfig } from '../core/worklets/animation-config';
import { withDecay, withSpring, withTiming } from './mocks/reanimated';

// biome-ignore lint/plugin: partial transition objects aren't directly assignable to MotiTransition's discriminated union without assertion — centralise the suppression here
const t = (obj: Record<string, unknown>) => obj as never;

describe('animationConfig', () => {
  describe('default animation type selection', () => {
    it('defaults to spring for non-colour, non-opacity keys', () => {
      const { animation } = animationConfig('scale', undefined);
      expect(animation).toBe(withSpring);
    });

    it('defaults to timing for opacity', () => {
      const { animation } = animationConfig('opacity', undefined);
      expect(animation).toBe(withTiming);
    });

    it('defaults to timing for colour keys', () => {
      const { animation } = animationConfig('backgroundColor', undefined);
      expect(animation).toBe(withTiming);
    });
  });

  describe('explicit type override', () => {
    it('uses timing when transition.type is timing', () => {
      const { animation } = animationConfig('scale', t({ type: 'timing', duration: 200 }));
      expect(animation).toBe(withTiming);
    });

    it('uses spring when transition.type is spring', () => {
      const { animation } = animationConfig('opacity', t({ type: 'spring' }));
      expect(animation).toBe(withSpring);
    });

    it('uses decay when transition.type is decay', () => {
      const { animation } = animationConfig('translateX', t({ type: 'decay' }));
      expect(animation).toBe(withDecay);
    });

    it('uses identity function for no-animation type', () => {
      const { animation } = animationConfig('opacity', t({ type: 'no-animation' }));
      // typeof-guard: avoids `as` casts and the banned `Function` type.
      expect(typeof animation === 'function' ? animation(42) : undefined).toBe(42);
    });
  });

  describe('per-key type override', () => {
    it('uses the per-key type over the root type', () => {
      const { animation } = animationConfig('scale', t({ type: 'timing', scale: { type: 'spring' } }));
      expect(animation).toBe(withSpring);
    });
  });

  describe('repeat / loop config', () => {
    it('sets repeatCount to -1 when loop is true', () => {
      const { repeatCount, shouldRepeat } = animationConfig('opacity', t({ loop: true }));
      expect(repeatCount).toBe(-1);
      expect(shouldRepeat).toBe(true);
    });

    it('sets repeatCount to 0 when loop is false', () => {
      const { repeatCount, shouldRepeat } = animationConfig('opacity', t({ loop: false }));
      expect(repeatCount).toBe(0);
      expect(shouldRepeat).toBe(false);
    });

    it('uses repeat count when provided', () => {
      const { repeatCount, shouldRepeat } = animationConfig('opacity', t({ repeat: 3 }));
      expect(repeatCount).toBe(3);
      expect(shouldRepeat).toBe(true);
    });

    it('defaults repeatReverse to true', () => {
      const { repeatReverse } = animationConfig('opacity', undefined);
      expect(repeatReverse).toBe(true);
    });

    it('respects repeatReverse: false', () => {
      const { repeatReverse } = animationConfig('opacity', t({ repeatReverse: false }));
      expect(repeatReverse).toBe(false);
    });
  });

  describe('timing config extraction', () => {
    it('extracts duration into config', () => {
      const { config } = animationConfig('opacity', t({ type: 'timing', duration: 400 }));
      expect(config.duration).toBe(400);
    });

    it('extracts easing into config', () => {
      const easing = (n: number) => n * n;
      const { config } = animationConfig('opacity', t({ type: 'timing', easing }));
      expect(config.easing).toBe(easing);
    });
  });

  describe('spring config extraction', () => {
    it('extracts damping and stiffness into config', () => {
      const { config } = animationConfig('scale', t({ type: 'spring', damping: 24, stiffness: 280 }));
      expect(config.damping).toBe(24);
      expect(config.stiffness).toBe(280);
    });

    it('per-key spring config overrides root', () => {
      const { config } = animationConfig('scale', t({ damping: 10, scale: { damping: 50 } }));
      expect(config.damping).toBe(50);
    });
  });
});
