import type { WithDecayConfig, WithSpringConfig } from 'react-native-reanimated';
import { ReduceMotion, withDecay, withSpring, withTiming } from 'react-native-reanimated';
import type { MotiTransition, TransitionConfig } from '../types';
import { isColor } from './style-predicates';

const WITH_DECAY_CONFIG_KEYS: (keyof WithDecayConfig)[] = ['clamp', 'velocity', 'deceleration', 'velocityFactor', 'reduceMotion'];

type RepeatState = { repeatCount: number; repeatReverse: boolean };
type ConfigResult = { config: Record<string, unknown>; reduceMotion: ReduceMotion };
// biome-ignore lint/suspicious/noExplicitAny: dynamic per-key access on the transition union — style keys are runtime values absent from the static type
type TransitionLike = any;

function identity(value: unknown): unknown {
  'worklet';
  return value;
}

/** `specific ?? fallback` — the per-style-key override wins, the shared transition backs it. */
const prefer = <T>(specific: T | null | undefined, fallback: T | null | undefined): T | null | undefined => {
  'worklet';
  if (specific !== null && specific !== undefined) return specific;
  return fallback;
};

function resolveAnimationType(
  key: string,
  styleSpecificTransition: TransitionLike,
  transition: TransitionLike,
): Required<TransitionConfig>['type'] {
  'worklet';
  let animationType: Required<TransitionConfig>['type'] = 'spring';
  if (isColor(key) || key === 'opacity') animationType = 'timing';
  if (styleSpecificTransition?.type) animationType = styleSpecificTransition.type;
  else if (transition?.type) animationType = transition.type;
  return animationType;
}

function resolveRepeat(styleSpecificTransition: TransitionLike, transition: TransitionLike): RepeatState {
  'worklet';
  let repeatCount = 0;
  let repeatReverse = true;

  const loop = prefer(styleSpecificTransition?.loop, transition?.loop);
  if (loop !== null && loop !== undefined) repeatCount = loop ? -1 : 0;

  const repeat = prefer(styleSpecificTransition?.repeat, transition?.repeat);
  if (repeat !== null && repeat !== undefined) repeatCount = repeat;

  const reverse = prefer(styleSpecificTransition?.repeatReverse, transition?.repeatReverse);
  if (reverse !== null && reverse !== undefined) repeatReverse = reverse;

  return { repeatCount, repeatReverse };
}

// Spring and decay walk a fixed config-key list and promote `reduceMotion` out so
// the With* call can pass it through; `timing` uses duration/easing instead and
// `no-animation` is the identity, so those two stay explicit in `animationConfig`.
function copyConfig(
  configKeys: readonly (keyof WithSpringConfig | keyof WithDecayConfig)[],
  styleSpecificTransition: TransitionLike,
  transition: TransitionLike,
): ConfigResult {
  'worklet';
  const config: Record<string, unknown> = {};
  let reduceMotion = ReduceMotion.System;
  for (const configKey of configKeys) {
    const styleSpecificConfig = styleSpecificTransition?.[configKey];
    const transitionConfigForKey = transition?.[configKey];
    if (configKey === 'reduceMotion' && (transitionConfigForKey || styleSpecificConfig))
      reduceMotion = transitionConfigForKey ?? styleSpecificConfig;
    if (styleSpecificConfig !== null && styleSpecificConfig !== undefined) config[configKey] = styleSpecificConfig;
    else if (transitionConfigForKey !== null && transitionConfigForKey !== undefined) config[configKey] = transitionConfigForKey;
  }
  return { config, reduceMotion };
}

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

export function animationConfig<Animate>(styleProp: string, transition: MotiTransition<Animate> | undefined) {
  'worklet';

  const key = styleProp;
  // biome-ignore lint/suspicious/noExplicitAny: dynamic per-key access on the transition union — style keys are runtime values absent from the static type
  // biome-ignore lint/plugin: dynamic per-key access on the transition union — style keys are runtime values absent from the static type
  const transitionAny = transition as any;
  const styleSpecificTransition = transitionAny?.[key];

  const animationType = resolveAnimationType(key, styleSpecificTransition, transitionAny);
  const { repeatCount: baseRepeatCount, repeatReverse } = resolveRepeat(styleSpecificTransition, transitionAny);

  let config: Record<string, unknown> = {};
  let reduceMotion = ReduceMotion.System;
  // biome-ignore lint/suspicious/noExplicitAny: holds withTiming/withSpring/withDecay/identity which have incompatible signatures; any is the only practical union here
  let animation: (...args: any[]) => any = identity;
  let repeatCount = baseRepeatCount;

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
  } else if (animationType === 'spring' || animationType === 'decay') {
    animation = animationType === 'spring' ? withSpring : withDecay;
    const configKeys = animationType === 'spring' ? withSpringConfigKeys : WITH_DECAY_CONFIG_KEYS;
    const result = copyConfig(configKeys, styleSpecificTransition, transitionAny);
    config = result.config;
    reduceMotion = result.reduceMotion;
  } else {
    animation = identity;
    config = {};
    repeatCount = 0;
  }

  return { animation, config, reduceMotion, repeatReverse, repeatCount, shouldRepeat: Boolean(repeatCount) };
}
