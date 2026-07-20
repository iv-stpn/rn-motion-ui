/**
 * Minimal mock for react-native-reanimated used in vitest unit tests.
 * Each animation factory returns a tagged descriptor so tests can inspect
 * which animation and config were requested without running the Reanimated runtime.
 */

type AnimationDescriptor = { __type: string; value: unknown; config: Record<string, unknown>; callback?: unknown };

export const ReduceMotion = {
  System: 'system',
  Always: 'always',
  Never: 'never',
} as const;

export const withTiming = (value: unknown, config: Record<string, unknown> = {}, callback?: unknown): AnimationDescriptor => ({
  __type: 'withTiming',
  value,
  config,
  callback,
});

export const withSpring = (value: unknown, config: Record<string, unknown> = {}, callback?: unknown): AnimationDescriptor => ({
  __type: 'withSpring',
  value,
  config,
  callback,
});

export const withDecay = (config: Record<string, unknown> = {}): AnimationDescriptor => ({
  __type: 'withDecay',
  value: undefined,
  config,
});

export const withDelay = (delay: number, animation: unknown): unknown => ({
  __type: 'withDelay',
  delay,
  animation,
});

export const withRepeat = (animation: unknown, count: number, reverse: boolean, callback?: unknown): unknown => ({
  __type: 'withRepeat',
  animation,
  count,
  reverse,
  callback,
});

export const withSequence = (...animations: unknown[]): unknown => ({
  __type: 'withSequence',
  animations,
});

export const Easing = {
  linear: (t: number) => t,
  cubic: (t: number) => t * t * t,
  in: (easing: (t: number) => number) => easing,
  out: (easing: (t: number) => number) => easing,
  inOut: (easing: (t: number) => number) => easing,
};
