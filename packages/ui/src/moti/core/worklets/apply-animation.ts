import { withDelay, withRepeat, type withTiming } from 'react-native-reanimated';

type ApplyAnimationParams = {
  value: unknown;
  animation: (...props: unknown[]) => unknown;
  config: Record<string, unknown>;
  // biome-ignore lint/suspicious/noExplicitAny: animation factory callbacks have incompatible concrete signatures (completed, value, info) — any is the only practical union here, matching animation-config.ts
  callback: (...args: any[]) => any;
  shouldRepeat: boolean;
  repeatCount: number;
  repeatReverse: boolean;
  delayMs: number | undefined | null;
};

/**
 * Applies an animation with optional withRepeat and withDelay wrappers.
 * Centralises the repeat+delay pattern that appears on every animatable property.
 */
export function applyAnimation({
  value,
  animation,
  config,
  callback,
  shouldRepeat,
  repeatCount,
  repeatReverse,
  delayMs,
}: ApplyAnimationParams): unknown {
  'worklet';
  // biome-ignore lint/plugin: animation/withRepeat return unknown; withDelay/withRepeat need the concrete animation-node type
  let result = animation(value, config, callback) as ReturnType<typeof withTiming>;
  if (shouldRepeat) result = withRepeat(result, repeatCount, repeatReverse, undefined);
  if (delayMs !== undefined && delayMs !== null) return withDelay(delayMs, result);
  return result;
}
