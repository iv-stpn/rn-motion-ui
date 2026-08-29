import { describe, expect, it } from 'vitest';
import { applyStyleKey } from '../core/worklets/apply-style-key';

const noop = () => undefined;

describe('applyStyleKey', () => {
  it('animates each nested style value to its own inner value', () => {
    // `shadowOffset` (and any other nested style object) must resolve to the
    // scalar inner values, not the whole object. A regression test: this passed
    // the entire `{ width, height }` object to `withSpring` before the fix.
    const final: Record<string, unknown> & {
      transform: never[];
      shadowOffset: { width: { value: number }; height: { value: number } };
    } = { transform: [], shadowOffset: { width: { value: 0 }, height: { value: 0 } } };

    applyStyleKey({
      final,
      key: 'shadowOffset',
      value: { width: 2, height: 4 },
      transition: undefined,
      defaultDelay: undefined,
      callback: noop,
    });

    expect(final.shadowOffset.width.value).toBe(2);
    expect(final.shadowOffset.height.value).toBe(4);
  });

  it('leaves a plain scalar style key as a single animation node', () => {
    const final: Record<string, unknown> & { transform: never[]; opacity: { value: number } } = {
      transform: [],
      opacity: { value: 0 },
    };

    applyStyleKey({
      final,
      key: 'opacity',
      value: 1,
      transition: undefined,
      defaultDelay: undefined,
      callback: noop,
    });

    expect(final.opacity.value).toBe(1);
  });
});
