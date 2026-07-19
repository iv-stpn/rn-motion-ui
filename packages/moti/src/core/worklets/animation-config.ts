import type { WithDecayConfig, WithSpringConfig } from 'react-native-reanimated';
import { ReduceMotion, withDecay, withSpring, withTiming } from 'react-native-reanimated';
import type { MotiTransition, TransitionConfig } from '../types';
import { isColor } from './style-predicates';

export const withSpringConfigKeys: (keyof WithSpringConfig)[] = [
  'stiffness',
  'overshootClamping',
  'velocity',
  'reduceMotion',
  'mass',
  'damping',
  'duration',
  'dampingRatio',
];

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: exhaustive per-property animation config dispatch — each branch maps a distinct transition type and cannot be simplified without losing correctness
export function animationConfig<Animate>(styleProp: string, transition: MotiTransition<Animate> | undefined) {
  'worklet';

  const key = styleProp;
  let repeatCount = 0;
  let repeatReverse = true;

  let animationType: Required<TransitionConfig>['type'] = 'spring';
  if (isColor(key) || key === 'opacity') animationType = 'timing';

  // biome-ignore lint/suspicious/noExplicitAny: dynamic per-key access on the transition union — style keys are runtime values absent from the static type
  // biome-ignore lint/plugin: dynamic per-key access on the transition union — style keys are runtime values absent from the static type
  const transitionAny = transition as any;
  const styleSpecificTransition = transitionAny?.[key];

  if (styleSpecificTransition?.type) animationType = styleSpecificTransition.type;
  else if (transition?.type) animationType = transition.type;

  const loop = styleSpecificTransition?.loop ?? transition?.loop;
  if (loop !== null && loop !== undefined) repeatCount = loop ? -1 : 0;

  if (styleSpecificTransition?.repeat !== undefined && styleSpecificTransition.repeat !== null)
    repeatCount = styleSpecificTransition.repeat;
  else if (transition?.repeat !== undefined && transition.repeat !== null) repeatCount = transition.repeat;

  if (styleSpecificTransition?.repeatReverse !== undefined && styleSpecificTransition.repeatReverse !== null)
    repeatReverse = styleSpecificTransition.repeatReverse;
  else if (transition?.repeatReverse !== undefined && transition.repeatReverse !== null) repeatReverse = transition.repeatReverse;

  let config: Record<string, unknown> = {};
  let reduceMotion = ReduceMotion.System;
  // biome-ignore lint/suspicious/noExplicitAny: holds withTiming/withSpring/withDecay which have incompatible signatures; any is the only practical union here
  let animation: (...args: any[]) => any = (...props) => props;

  if (animationType === 'timing') {
    const duration = styleSpecificTransition?.duration ?? transitionAny?.duration;
    const easing = styleSpecificTransition?.easing ?? transitionAny?.easing;
    const timingReduceMotion = styleSpecificTransition?.reduceMotion ?? transitionAny?.reduceMotion;

    if (easing) config.easing = easing;
    if (duration !== null && duration !== undefined) config.duration = duration;
    if (timingReduceMotion) {
      reduceMotion = timingReduceMotion;
      config.reduceMotion = reduceMotion;
    }
    animation = withTiming;
  } else if (animationType === 'spring') {
    animation = withSpring;
    config = {};
    for (const configKey of withSpringConfigKeys) {
      const styleSpecificConfig = styleSpecificTransition?.[configKey];
      const transitionConfigForKey = transitionAny?.[configKey];
      if (configKey === 'reduceMotion' && (transitionConfigForKey || styleSpecificConfig))
        reduceMotion = transitionConfigForKey ?? styleSpecificConfig;
      if (styleSpecificConfig !== null && styleSpecificConfig !== undefined) config[configKey] = styleSpecificConfig;
      else if (transitionConfigForKey !== null && transitionConfigForKey !== undefined)
        config[configKey] = transitionConfigForKey;
    }
  } else if (animationType === 'decay') {
    animation = withDecay;
    config = {};
    const configKeys: (keyof WithDecayConfig)[] = ['clamp', 'velocity', 'deceleration', 'velocityFactor', 'reduceMotion'];
    for (const configKey of configKeys) {
      const styleSpecificConfig = styleSpecificTransition?.[configKey];
      const transitionConfigForKey = transitionAny?.[configKey];
      if (configKey === 'reduceMotion' && (transitionConfigForKey || styleSpecificConfig))
        reduceMotion = transitionConfigForKey ?? styleSpecificConfig;
      if (styleSpecificConfig !== null && styleSpecificConfig !== undefined) config[configKey] = styleSpecificConfig;
      else if (transitionConfigForKey !== null && transitionConfigForKey !== undefined)
        config[configKey] = transitionConfigForKey;
    }
  } else if (animationType === 'no-animation') {
    animation = (value: unknown) => value;
    config = {};
    repeatCount = 0;
  }

  return { animation, config, reduceMotion, repeatReverse, repeatCount, shouldRepeat: Boolean(repeatCount) };
}
