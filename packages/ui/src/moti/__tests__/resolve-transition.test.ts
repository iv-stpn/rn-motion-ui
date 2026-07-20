import { describe, expect, it } from 'vitest';
import { resolveTransition } from '../core/worklets/resolve-transition';

describe('resolveTransition', () => {
  it('returns undefined when all inputs are absent', () => {
    const result = resolveTransition({
      transitionProp: undefined,
      variantTransition: undefined,
      exitTransitionProp: undefined,
      isExiting: false,
      custom: () => undefined,
    });
    expect(result).toBeUndefined();
  });

  it('returns the plain transition prop as-is', () => {
    const result = resolveTransition({
      transitionProp: { type: 'timing', duration: 300 },
      variantTransition: undefined,
      exitTransitionProp: undefined,
      isExiting: false,
      custom: () => undefined,
    });
    expect(result).toMatchObject({ type: 'timing', duration: 300 });
  });

  it('unwraps a DerivedValue-shaped transition prop ({ value })', () => {
    const t = { type: 'spring', damping: 20 };
    const result = resolveTransition({
      transitionProp: { value: t },
      variantTransition: undefined,
      exitTransitionProp: undefined,
      isExiting: false,
      custom: () => undefined,
    });
    expect(result).toMatchObject({ type: 'spring', damping: 20 });
  });

  it('merges variant transition over the base transition', () => {
    const result = resolveTransition({
      transitionProp: { type: 'timing', duration: 300 },
      // biome-ignore lint/plugin: partial variant shape not assignable to MotiTransition<Animate> without assertion — same pattern used throughout the moti source
      variantTransition: { duration: 100 } as never,
      exitTransitionProp: undefined,
      isExiting: false,
      custom: () => undefined,
    });
    expect(result).toMatchObject({ type: 'timing', duration: 100 });
  });

  it('applies the plain exit transition when isExiting is true', () => {
    const result = resolveTransition({
      transitionProp: { type: 'spring' },
      variantTransition: undefined,
      exitTransitionProp: { type: 'timing', duration: 200 },
      isExiting: true,
      custom: () => undefined,
    });
    expect(result).toMatchObject({ type: 'timing', duration: 200 });
  });

  it('calls the exit factory with custom() when exitTransitionProp is a function', () => {
    const customData = { speed: 2 };
    const result = resolveTransition({
      transitionProp: undefined,
      variantTransition: undefined,
      exitTransitionProp: (c: unknown) => ({ type: 'timing', duration: 150, data: c }),
      isExiting: true,
      custom: () => customData,
    });
    expect(result).toMatchObject({ type: 'timing', duration: 150, data: customData });
  });

  it('does NOT apply the exit transition when isExiting is false', () => {
    const result = resolveTransition({
      transitionProp: { type: 'spring' },
      variantTransition: undefined,
      exitTransitionProp: { type: 'timing', duration: 999 },
      isExiting: false,
      custom: () => undefined,
    });
    expect(result).not.toHaveProperty('duration');
  });
});
