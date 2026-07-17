import { withDelay, type withTiming } from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';
import type { MotiTransition, SequenceItem, SequenceItemObject } from '../types';
import { animationConfig } from './animation-config';

type ResolvedSequenceStep = {
  value: unknown;
  delay: number | undefined;
  config: Record<string, unknown>;
  animation: (...props: unknown[]) => unknown;
  onDidAnimate: SequenceItemObject<unknown>['onDidAnimate'] | undefined;
};

/**
 * Normalises a single SequenceItem into a flat descriptor.
 * Returns null when the step value is null or false and should be skipped.
 */
// biome-ignore lint/complexity/useMaxParams: same positional-signature rationale as getSequenceArray
const resolveSequenceStep = (
  step: SequenceItem<unknown>,
  sequenceKey: string,
  defaultDelay: number | undefined,
  defaultConfig: Record<string, unknown>,
  defaultAnimation: (...props: unknown[]) => unknown,
): ResolvedSequenceStep | null => {
  'worklet';

  const stepObject =
    typeof step === 'object' && step !== null
      ? // biome-ignore lint/plugin: SequenceItem<unknown> collapses to unknown; typeof-narrowing yields `object` with no `.value`, so the item shape must be asserted
        (step as SequenceItemObject<unknown> & Record<string, unknown>)
      : null;

  const rawValue = stepObject === null ? step : stepObject.value;
  if (rawValue === null || rawValue === false) return null;

  if (stepObject === null)
    return { value: rawValue, delay: defaultDelay, config: defaultConfig, animation: defaultAnimation, onDidAnimate: undefined };

  const { delay: _delay, value: _value, onDidAnimate, ...stepTransition } = stepObject;

  const { config: inlineConfig, animation: inlineAnimation } = animationConfig(
    sequenceKey,
    // biome-ignore lint/plugin: destructured rest of a record; MotiTransition has no string index signature, so the transition shape must be asserted
    stepTransition as MotiTransition<unknown>,
  );

  return {
    value: stepObject.value,
    delay: stepObject.delay === null ? defaultDelay : stepObject.delay,
    config: { ...defaultConfig, ...inlineConfig },
    animation: inlineAnimation,
    onDidAnimate,
  };
};

type GetSequenceArrayParams = {
  sequenceKey: string;
  sequenceArray: SequenceItem<unknown>[];
  delayMs: number | undefined;
  config: Record<string, unknown>;
  animation: (...props: unknown[]) => unknown;
  callback: (completed: boolean | undefined, value: unknown, info: SequenceCallbackInfo) => void;
};

export type SequenceCallbackInfo = { attemptedSequenceValue: unknown };

export function getSequenceArray({ sequenceKey, sequenceArray, delayMs, config, animation, callback }: GetSequenceArrayParams) {
  'worklet';

  const sequence: unknown[] = [];

  for (const step of sequenceArray) {
    const resolved = resolveSequenceStep(step, sequenceKey, delayMs, config, animation);

    if (resolved !== null) {
      const {
        value: stepValue,
        delay: stepDelay,
        config: stepConfig,
        animation: stepAnimation,
        onDidAnimate: stepOnDidAnimate,
      } = resolved;

      // biome-ignore lint/style/useDefaultParameterLast: Reanimated animation-callback contract is (finished = false, current) — parameter order is fixed by the framework.
      const sequenceValue = stepAnimation(stepValue, stepConfig, (completed = false, maybeValue: unknown) => {
        'worklet';
        callback(completed, maybeValue, { attemptedSequenceValue: stepValue });
        if (stepOnDidAnimate)
          // biome-ignore lint/plugin: runOnJS needs a concrete variadic signature; the onDidAnimate field's type isn't callable-compatible without an assertion
          runOnJS(stepOnDidAnimate as (...args: unknown[]) => void)(completed, maybeValue, {
            attemptedSequenceItemValue: stepValue,
            attemptedSequenceArray: maybeValue,
          });
      });

      if (stepDelay === undefined) sequence.push(sequenceValue);
      // biome-ignore lint/plugin: stepAnimation returns unknown; withDelay needs the concrete animation-node type, unrecoverable from unknown
      else sequence.push(withDelay(stepDelay, sequenceValue as ReturnType<typeof withTiming>));
    }
  }

  return sequence;
}
