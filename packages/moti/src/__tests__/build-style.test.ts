import { describe, expect, it } from 'vitest';
import { buildExitingStyleProps, buildMergedStyles } from '../core/worklets/build-style';

// Typed explicitly so TypeScript doesn't infer `{}` and narrow Animate to the empty type.
const EMPTY_INITIAL: { opacity?: number; scale?: number } = {};

/** Base params that keep each test focused on the variable under test. */
const base = {
  animateStyle: { opacity: 1, scale: 1 },
  variantStyle: { opacity: 1, scale: 1 },
  initialStyle: EMPTY_INITIAL,
  exitStyle: undefined,
  stylePriority: 'animate' as const,
  isMounted: true,
  disableInitialAnimation: false,
  isExiting: false,
};

describe('buildMergedStyles', () => {
  it('returns the animate style when no variant is set', () => {
    expect(buildMergedStyles(base)).toMatchObject({ opacity: 1, scale: 1 });
  });

  it('animate wins for all its keys when stylePriority is animate', () => {
    // merged = { ...variantStyle, ...animateStyle } — animate overwrites variant for any key both define
    expect(
      buildMergedStyles({
        ...base,
        animateStyle: { opacity: 1, scale: 1 },
        variantStyle: { opacity: 0.5, scale: 2 },
        stylePriority: 'animate',
      }),
    ).toMatchObject({ opacity: 1, scale: 1 });
  });

  it('variant wins for all its keys when stylePriority is state', () => {
    // merged = { ...animateStyle, ...variantStyle } — variant overwrites animate
    expect(
      buildMergedStyles({
        ...base,
        animateStyle: { opacity: 1, scale: 1 },
        variantStyle: { opacity: 0.5, scale: 2 },
        stylePriority: 'state',
      }),
    ).toMatchObject({ opacity: 0.5, scale: 2 });
  });

  it('uses only initial style when not yet mounted', () => {
    // !isMounted && !disableInitialAnimation && initialStyle has keys → return initialStyle
    expect(
      buildMergedStyles({
        ...base,
        initialStyle: { opacity: 0, scale: 0.8 },
        isMounted: false,
        disableInitialAnimation: false,
      }),
    ).toMatchObject({ opacity: 0, scale: 0.8 });
  });

  it('skips initial style when disableInitialAnimation is true', () => {
    expect(
      buildMergedStyles({
        ...base,
        initialStyle: { opacity: 0, scale: 0.8 },
        isMounted: false,
        disableInitialAnimation: true,
      }),
    ).toMatchObject({ opacity: 1, scale: 1 });
  });

  it('uses exit style when isExiting is true', () => {
    expect(
      buildMergedStyles({
        ...base,
        exitStyle: { opacity: 0, scale: 0.8 },
        isExiting: true,
      }),
    ).toMatchObject({ opacity: 0, scale: 0.8 });
  });

  it('ignores boolean exit style when isExiting is true', () => {
    // boolean exitStyle is ignored — animate+variant merge is returned
    expect(
      buildMergedStyles({
        ...base,
        exitStyle: true,
        isExiting: true,
      }),
    ).toMatchObject({ opacity: 1, scale: 1 });
  });
});

describe('buildExitingStyleProps', () => {
  it('returns empty object for null/undefined/boolean exit styles', () => {
    expect(buildExitingStyleProps(undefined)).toEqual({});
    expect(buildExitingStyleProps(null)).toEqual({});
    expect(buildExitingStyleProps(true)).toEqual({});
    expect(buildExitingStyleProps(false)).toEqual({});
  });

  it('returns a truthy entry for each animatable exit key', () => {
    const result = buildExitingStyleProps({ opacity: 0, scale: 0 });
    expect(result.opacity).toBe(true);
    expect(result.scale).toBe(true);
  });

  it('excludes non-animatable layout/style props', () => {
    const result = buildExitingStyleProps({
      opacity: 0,
      position: 'absolute',
      zIndex: 10,
      borderStyle: 'solid',
    });
    expect(result.opacity).toBe(true);
    expect(result.position).toBeUndefined();
    expect(result.zIndex).toBeUndefined();
    expect(result.borderStyle).toBeUndefined();
  });
});

describe('buildMergedStyles', () => {
  it('returns the animate style when no variant is set', () => {
    const result = buildMergedStyles(base);
    expect(result.opacity).toBe(1);
    expect(result.scale).toBe(1);
  });

  it('animate wins for all its keys when stylePriority is animate', () => {
    // merged = { ...variantStyle, ...animateStyle } — animate overwrites variant for any key both define
    const result = buildMergedStyles({
      ...base,
      animateStyle: { opacity: 1, scale: 1 },
      variantStyle: { opacity: 0.5, scale: 2 },
      stylePriority: 'animate',
    });
    expect(result.opacity).toBe(1);
    expect(result.scale).toBe(1);
  });

  it('variant provides a key not present in animateStyle when stylePriority is animate', () => {
    const result = buildMergedStyles({
      ...base,
      animateStyle: { opacity: 1, scale: 1 },
      variantStyle: { opacity: 0.5, scale: 2 },
      stylePriority: 'animate',
    });
    // animate wins for both opacity and scale since both keys exist in animateStyle
    expect(result.opacity).toBe(1);
    expect(result.scale).toBe(1);
  });

  it('variant wins for all its keys when stylePriority is state', () => {
    // merged = { ...animateStyle, ...variantStyle } — variant overwrites animate
    const result = buildMergedStyles({
      ...base,
      animateStyle: { opacity: 1, scale: 1 },
      variantStyle: { opacity: 0.5, scale: 2 },
      stylePriority: 'state',
    });
    expect(result.opacity).toBe(0.5);
    expect(result.scale).toBe(2);
  });

  it('uses only initial style when not yet mounted', () => {
    // !isMounted && !disableInitialAnimation && initialStyle has keys → return initialStyle
    const result = buildMergedStyles({
      ...base,
      animateStyle: { opacity: 1, scale: 1 },
      variantStyle: { opacity: 1, scale: 1 },
      initialStyle: { opacity: 0, scale: 0.8 },
      isMounted: false,
      disableInitialAnimation: false,
    });
    expect(result).toMatchObject({ opacity: 0, scale: 0.8 });
  });

  it('skips initial style when disableInitialAnimation is true', () => {
    const result = buildMergedStyles({
      ...base,
      animateStyle: { opacity: 1, scale: 1 },
      variantStyle: { opacity: 1, scale: 1 },
      initialStyle: { opacity: 0, scale: 0.8 },
      isMounted: false,
      disableInitialAnimation: true,
    });
    // initial is skipped, animate wins
    expect(result.opacity).toBe(1);
    expect(result.scale).toBe(1);
  });

  it('uses exit style when isExiting is true', () => {
    const result = buildMergedStyles({
      ...base,
      animateStyle: { opacity: 1, scale: 1 },
      variantStyle: { opacity: 1, scale: 1 },
      exitStyle: { opacity: 0, scale: 0.8 },
      isExiting: true,
    });
    expect(result).toMatchObject({ opacity: 0, scale: 0.8 });
  });

  it('ignores boolean exit style when isExiting is true', () => {
    const result = buildMergedStyles({
      ...base,
      animateStyle: { opacity: 1, scale: 1 },
      variantStyle: { opacity: 1, scale: 1 },
      exitStyle: true,
      isExiting: true,
    });
    // boolean exitStyle is ignored — animate+variant merge is returned
    expect(result.opacity).toBe(1);
  });
});

describe('buildExitingStyleProps', () => {
  it('returns empty object for null/undefined/boolean exit styles', () => {
    expect(buildExitingStyleProps(undefined)).toEqual({});
    expect(buildExitingStyleProps(null)).toEqual({});
    expect(buildExitingStyleProps(true)).toEqual({});
    expect(buildExitingStyleProps(false)).toEqual({});
  });

  it('returns a truthy entry for each animatable exit key', () => {
    const result = buildExitingStyleProps({ opacity: 0, scale: 0 });
    expect(result.opacity).toBe(true);
    expect(result.scale).toBe(true);
  });

  it('excludes non-animatable layout/style props', () => {
    const result = buildExitingStyleProps({
      opacity: 0,
      position: 'absolute',
      zIndex: 10,
      borderStyle: 'solid',
    });
    expect(result.opacity).toBe(true);
    expect(result.position).toBeUndefined();
    expect(result.zIndex).toBeUndefined();
    expect(result.borderStyle).toBeUndefined();
  });
});
