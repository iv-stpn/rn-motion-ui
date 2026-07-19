import { describe, expect, it, vi } from 'vitest';
import { getSequenceArray } from '../core/worklets/get-sequence-array';
import { withSpring, withTiming } from './mocks/reanimated';

// biome-ignore lint/plugin: mock animation functions don't match Reanimated's type signature — centralise the suppression here so every `mockAnim(...)` call below is clean
const mockAnim = (fn: typeof withTiming | typeof withSpring) => fn as never;

describe('getSequenceArray', () => {
  const noop = () => undefined;

  it('returns an empty array for an empty sequence', () => {
    const result = getSequenceArray({
      sequenceKey: 'opacity',
      sequenceArray: [],
      delayMs: undefined,
      config: {},
      animation: mockAnim(withTiming),
      callback: noop,
    });
    expect(result).toHaveLength(0);
  });

  it('maps scalar values through the animation function', () => {
    const result = getSequenceArray({
      sequenceKey: 'opacity',
      sequenceArray: [0, 1, 0.5],
      delayMs: undefined,
      config: {},
      animation: mockAnim(withTiming),
      callback: noop,
    });
    expect(result).toHaveLength(3);
    expect(result[0]).toHaveProperty('__type', 'withTiming');
    expect(result[0]).toHaveProperty('value', 0);
    expect(result[1]).toHaveProperty('value', 1);
    expect(result[2]).toHaveProperty('value', 0.5);
  });

  it('skips steps whose value is null', () => {
    const result = getSequenceArray({
      sequenceKey: 'opacity',
      sequenceArray: [1, null, 0],
      delayMs: undefined,
      config: {},
      animation: mockAnim(withTiming),
      callback: noop,
    });
    expect(result).toHaveLength(2);
  });

  it('skips steps whose value is false', () => {
    const result = getSequenceArray({
      sequenceKey: 'opacity',
      // biome-ignore lint/plugin: false is in the SequenceItem union at runtime but TypeScript narrows it away — `as never` required to construct this test fixture
      sequenceArray: [1, false as never, 0],
      delayMs: undefined,
      config: {},
      animation: mockAnim(withTiming),
      callback: noop,
    });
    expect(result).toHaveLength(2);
  });

  it('wraps steps with a per-step delay using withDelay', () => {
    const result = getSequenceArray({
      sequenceKey: 'opacity',
      sequenceArray: [{ value: 1, delay: 100 }],
      delayMs: undefined,
      config: {},
      animation: mockAnim(withTiming),
      callback: noop,
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('__type', 'withDelay');
    expect(result[0]).toHaveProperty('delay', 100);
  });

  it('uses the default delayMs when a scalar step has no per-step delay', () => {
    // defaultDelay is forwarded only for scalar steps (non-object); object steps
    // use stepObject.delay (undefined when the key is absent, not defaultDelay).
    const result = getSequenceArray({
      sequenceKey: 'opacity',
      sequenceArray: [0.5],
      delayMs: 200,
      config: {},
      animation: mockAnim(withTiming),
      callback: noop,
    });
    expect(result[0]).toHaveProperty('__type', 'withDelay');
    expect(result[0]).toHaveProperty('delay', 200);
  });

  it('does NOT apply defaultDelayMs to object steps without an explicit delay field', () => {
    // For object steps, delay comes from stepObject.delay. When absent (undefined),
    // the animation is not wrapped with withDelay even if delayMs is set.
    const result = getSequenceArray({
      sequenceKey: 'opacity',
      sequenceArray: [{ value: 0.5 }],
      delayMs: 200,
      config: {},
      animation: mockAnim(withTiming),
      callback: noop,
    });
    expect(result[0]).toHaveProperty('__type', 'withTiming');
  });

  it('uses per-step transition type when provided in an object step', () => {
    const result = getSequenceArray({
      sequenceKey: 'scale',
      sequenceArray: [{ value: 2, type: 'spring' }],
      delayMs: undefined,
      config: {},
      animation: mockAnim(withTiming),
      callback: noop,
    });
    expect(result[0]).toHaveProperty('__type', 'withSpring');
  });

  it('invokes the callback when a step completes', () => {
    const callback = vi.fn();
    const result = getSequenceArray({
      sequenceKey: 'opacity',
      sequenceArray: [0.5],
      delayMs: undefined,
      config: {},
      animation: mockAnim(withTiming),
      callback,
    });
    // The mock descriptor stores the animation callback under `.callback`. Use
    // Reflect.get (returns `any`) + a typeof guard to invoke it without `as` casts.
    const step = result[0];
    const cb = Reflect.get(new Object(step), 'callback');
    if (typeof cb === 'function') cb(true, 0.5);
    expect(callback).toHaveBeenCalledWith(true, 0.5, { attemptedSequenceValue: 0.5 });
  });

  it('uses withSpring by default for non-opacity/color keys', () => {
    const result = getSequenceArray({
      sequenceKey: 'scale',
      sequenceArray: [2],
      delayMs: undefined,
      config: {},
      animation: mockAnim(withSpring),
      callback: noop,
    });
    expect(result[0]).toHaveProperty('__type', 'withSpring');
  });
});
