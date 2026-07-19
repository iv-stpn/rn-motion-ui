import { describe, expect, it } from 'vitest';
import { isColor, isTransform } from '../core/worklets/style-predicates';

describe('isColor', () => {
  it('returns true for colour-valued style keys', () => {
    const colorKeys = [
      'backgroundColor',
      'borderBottomColor',
      'borderLeftColor',
      'borderRightColor',
      'borderTopColor',
      'color',
      'shadowColor',
      'borderColor',
      'borderEndColor',
      'borderStartColor',
    ];
    // biome-ignore lint/plugin: iterating over a fixed set of keys to verify each one individually — it.each would be equivalent but this reads more clearly for a membership check
    for (const key of colorKeys) {
      expect(isColor(key)).toBe(true);
    }
  });

  it('returns false for non-colour style keys', () => {
    expect(isColor('opacity')).toBe(false);
    expect(isColor('width')).toBe(false);
    expect(isColor('translateX')).toBe(false);
    expect(isColor('scale')).toBe(false);
    expect(isColor('')).toBe(false);
  });
});

describe('isTransform', () => {
  it('returns true for shorthand transform keys', () => {
    const transformKeys = [
      'perspective',
      'rotate',
      'rotateX',
      'rotateY',
      'rotateZ',
      'scale',
      'scaleX',
      'scaleY',
      'translateX',
      'translateY',
      'skewX',
      'skewY',
    ];
    // biome-ignore lint/plugin: iterating over a fixed set of keys to verify each one individually — it.each would be equivalent but this reads more clearly for a membership check
    for (const key of transformKeys) {
      expect(isTransform(key)).toBe(true);
    }
  });

  it('returns false for non-transform style keys', () => {
    expect(isTransform('transform')).toBe(false);
    expect(isTransform('opacity')).toBe(false);
    expect(isTransform('backgroundColor')).toBe(false);
    expect(isTransform('width')).toBe(false);
    expect(isTransform('')).toBe(false);
  });
});
