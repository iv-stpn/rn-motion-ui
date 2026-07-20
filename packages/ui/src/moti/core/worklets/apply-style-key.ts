import type { TransformsStyle } from 'react-native';
import { withRepeat, withSequence, type withTiming } from 'react-native-reanimated';
import { hasKey } from '../../../utils/typeguards';
import type { MotiTransition } from '../types';
import { animationConfig } from './animation-config';
import { animationDelay } from './animation-delay';
import { applyAnimation } from './apply-animation';
import { getSequenceArray } from './get-sequence-array';
import type { AnimationCallbackInfo } from './make-animation-callback';
import { isTransform } from './style-predicates';

type StyleFinal = Record<string, unknown> & { transform: TransformsStyle['transform'] };

type ApplyStyleKeyOptions = {
  final: StyleFinal;
  key: string;
  value: unknown;
  transition: MotiTransition<unknown> | undefined;
  defaultDelay: number | undefined;
  callback: (completed?: boolean, recentValue?: unknown, info?: AnimationCallbackInfo) => void;
};

/**
 * Applies a single resolved style key to `final`, dispatching over the five
 * cases: explicit `transform` array, sequence-array, shorthand-transform,
 * nested object, and plain scalar.
 *
 * Mutates `final` in place — mirrors the pattern used by the surrounding
 * useAnimatedStyle reducer.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: exhaustive dispatch over all animatable style shapes — each branch is a distinct case that cannot be merged without losing correctness
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: see above — one function per shape keeps the call-site in use-motify.ts to a single applyStyleKey() call per key
export function applyStyleKey({ final, key, value, transition, defaultDelay, callback }: ApplyStyleKeyOptions): void {
  'worklet';

  const { animation, config, shouldRepeat, repeatCount, repeatReverse } = animationConfig(key, transition);
  let { delayMs } = animationDelay(key, transition, defaultDelay);

  if (key === 'transform') {
    if (!Array.isArray(value)) {
      console.error('[moti]: Invalid transform value. Needs to be an array.');
      return;
    }
    for (const transformObject of value) {
      final.transform = final.transform || [];
      // biome-ignore lint/plugin: noUncheckedIndexedAccess widens Object.keys(...)[0] to string | undefined; a transform object always has exactly one key
      const transformKey = Object.keys(transformObject)[0] as string;
      const transformValue = transformObject[transformKey];
      const transform: Record<string, unknown> = {};

      if (Array.isArray(transformValue)) {
        const sequence = getSequenceArray({
          sequenceKey: transformKey,
          sequenceArray: transformValue,
          delayMs,
          config,
          animation,
          callback,
        });
        if (sequence.length) {
          // biome-ignore lint/plugin: getSequenceArray returns unknown[]; withSequence needs the animation-object tuple shape, unrecoverable from unknown
          const sequenceTuple = sequence as [ReturnType<typeof withTiming>, ...ReturnType<typeof withTiming>[]];
          let finalValue = withSequence(...sequenceTuple);
          if (shouldRepeat) finalValue = withRepeat(finalValue, repeatCount, repeatReverse, callback);
          transform[transformKey] = finalValue;
        }
      } else {
        // biome-ignore lint/plugin: dynamic transform-key lookup for a per-key delay — MotiTransition has no string index signature, so it needs an assertion
        const transitionByKey = transition as Record<string, { delay?: number } | undefined> | undefined;
        const transformDelayMs =
          transitionByKey?.[transformKey]?.delay === null ? delayMs : (transitionByKey?.[transformKey]?.delay ?? delayMs);

        let configKey = transformKey;
        if (transition && hasKey('transform', transition) && !hasKey(configKey, transition)) configKey = 'transform';

        const {
          animation: tAnim,
          config: tConfig,
          shouldRepeat: tShouldRepeat,
          repeatCount: tRepeatCount,
          repeatReverse: tRepeatReverse,
        } = animationConfig(configKey, transition);

        // biome-ignore lint/plugin: applyAnimation returns unknown; transform needs the concrete animation-node type
        transform[transformKey] = applyAnimation({
          value: transformValue,
          animation: tAnim,
          config: tConfig,
          callback,
          shouldRepeat: tShouldRepeat,
          repeatCount: tRepeatCount,
          repeatReverse: tRepeatReverse,
          delayMs: transformDelayMs,
        }) as ReturnType<typeof withTiming>;
      }

      if (Object.keys(transform).length && Array.isArray(final.transform)) final.transform.push(transform);
    }
  } else if (Array.isArray(value)) {
    const sequence = getSequenceArray({ sequenceKey: key, sequenceArray: value, delayMs, config, animation, callback });
    // biome-ignore lint/plugin: getSequenceArray returns unknown[]; withSequence needs the animation-object tuple shape, unrecoverable from unknown
    let finalValue = withSequence(...(sequence as [ReturnType<typeof withTiming>, ...ReturnType<typeof withTiming>[]]));
    if (shouldRepeat) finalValue = withRepeat(finalValue, repeatCount, repeatReverse, undefined);

    if (isTransform(key)) {
      final.transform = final.transform || [];
      if (sequence.length) {
        const transform: Record<string, unknown> = {};
        transform[key] = finalValue;
        // biome-ignore lint/plugin: final.transform is TransformsStyle['transform'] (a readonly union); pushing requires the mutable-array assertion
        (final.transform as unknown[]).push(transform);
      }
    } else if (sequence.length) final[key] = finalValue;
  } else if (isTransform(key)) {
    final.transform = final.transform || [];

    // biome-ignore lint/plugin: dynamic per-key delay lookup on the transition union — the runtime style key isn't in MotiTransition's static shape
    const keyTransitionDelay = (transition as Record<string, Record<string, number> | undefined> | undefined)?.[key]?.delay;
    // Only a per-key delay that is actually set may override the resolved
    // delayMs — an absent (undefined) per-key delay must not erase the
    // top-level transition delay (per-letter staggers depend on it).
    if (keyTransitionDelay !== null && keyTransitionDelay !== undefined) delayMs = keyTransitionDelay;

    const transform: Record<string, unknown> = {};
    // biome-ignore lint/plugin: applyAnimation returns unknown; transform needs the concrete animation-node type
    transform[key] = applyAnimation({
      value,
      animation,
      config,
      callback,
      shouldRepeat,
      repeatCount,
      repeatReverse,
      delayMs,
    }) as ReturnType<typeof withTiming>;
    // biome-ignore lint/plugin: final.transform is TransformsStyle['transform'] (a readonly union); pushing requires the mutable-array assertion
    (final.transform as unknown[]).push(transform);
  } else if (typeof value === 'object' && value !== null) {
    final[key] = {};
    // biome-ignore lint/plugin: final[key] was just set to {}; the index-write target needs a Record shape that its `unknown` value type doesn't provide
    const nested = final[key] as Record<string, unknown>;
    for (const innerStyleKey of Object.keys(value)) {
      // biome-ignore lint/plugin: applyAnimation returns unknown; nested style value needs the concrete animation-node type
      nested[innerStyleKey] = applyAnimation({
        value,
        animation,
        config,
        callback,
        shouldRepeat,
        repeatCount,
        repeatReverse,
        delayMs,
      }) as ReturnType<typeof withTiming>;
    }
  } else {
    // biome-ignore lint/plugin: applyAnimation returns unknown; final style value needs the concrete animation-node type
    final[key] = applyAnimation({
      value,
      animation,
      config,
      callback,
      shouldRepeat,
      repeatCount,
      repeatReverse,
      delayMs,
    }) as ReturnType<typeof withTiming>;
  }
}
