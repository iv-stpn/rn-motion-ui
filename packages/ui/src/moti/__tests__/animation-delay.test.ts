import { describe, expect, it } from 'vitest';
import { animationDelay } from '../core/worklets/animation-delay';

describe('animationDelay', () => {
  it('returns undefined when no delay is configured', () => {
    const { delayMs } = animationDelay('opacity', undefined, undefined);
    expect(delayMs).toBeUndefined();
  });

  it('returns the default delay when no transition is provided', () => {
    const { delayMs } = animationDelay('opacity', undefined, 200);
    expect(delayMs).toBe(200);
  });

  it('returns a root-level transition delay', () => {
    const { delayMs } = animationDelay('opacity', { delay: 100 }, undefined);
    expect(delayMs).toBe(100);
  });

  it('returns a per-key delay over the root delay', () => {
    // opacity key has delay:50, root has delay:300 — per-key wins.
    // biome-ignore lint/plugin: per-key transition fields aren't in the base MotiTransition type; `as never` is the project-wide pattern for test inputs with extra per-key overrides
    const { delayMs } = animationDelay('opacity', { delay: 300, opacity: { delay: 50 } } as never, undefined);
    expect(delayMs).toBe(50);
  });

  it('per-key delay of 0 is treated as a valid override (not falsy-skipped)', () => {
    // biome-ignore lint/plugin: per-key transition fields aren't in the base MotiTransition type; `as never` is the project-wide pattern for test inputs with extra per-key overrides
    const { delayMs } = animationDelay('scale', { delay: 200, scale: { delay: 0 } } as never, undefined);
    expect(delayMs).toBe(0);
  });

  it('per-key delay of null falls through to root delay', () => {
    // biome-ignore lint/plugin: per-key transition fields aren't in the base MotiTransition type; `as never` is the project-wide pattern for test inputs with extra per-key overrides
    const { delayMs } = animationDelay('scale', { delay: 150, scale: { delay: null } } as never, undefined);
    expect(delayMs).toBe(150);
  });

  it('root delay overrides default delay', () => {
    const { delayMs } = animationDelay('opacity', { delay: 80 }, 500);
    expect(delayMs).toBe(80);
  });
});
