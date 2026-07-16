import { useEffect, useMemo } from 'react';
import type { TransformsStyle } from 'react-native';
import type { WithDecayConfig, WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';
import {
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { PresenceContextValue, usePresence as UsePresenceFn } from '../presence/AnimatePresence';
import { PackageName } from './constants/package-name';
import type {
  InlineOnDidAnimate,
  MotiProps,
  MotiTransition,
  SequenceItem,
  SequenceItemObject,
  Transforms,
  TransitionConfig,
  WithTransition,
} from './types';

const debug = (...args: unknown[]) => {
  'worklet';
  // @ts-expect-error global debug flag
  if (!global.shouldDebugMoti) return;
  if (args) console.log('[moti]', ...args);
};

const isColor = (styleKey: string) => {
  'worklet';
  const keys: Record<string, boolean> = {
    backgroundColor: true,
    borderBottomColor: true,
    borderLeftColor: true,
    borderRightColor: true,
    borderTopColor: true,
    color: true,
    shadowColor: true,
    borderColor: true,
    borderEndColor: true,
    borderStartColor: true,
  };
  return Boolean(keys[styleKey]);
};

const isTransform = (styleKey: string) => {
  'worklet';
  const transforms: Record<keyof Transforms, boolean> = {
    perspective: true,
    rotate: true,
    rotateX: true,
    rotateY: true,
    rotateZ: true,
    scale: true,
    scaleX: true,
    scaleY: true,
    translateX: true,
    translateY: true,
    skewX: true,
    skewY: true,
  };
  return Boolean(transforms[styleKey as keyof Transforms]);
};

function animationDelay<Animate>(_key: string, transition: MotiTransition<Animate> | undefined, defaultDelay?: number) {
  'worklet';
  const key = _key as keyof Animate;
  let delayMs: TransitionConfig['delay'] = defaultDelay;
  if (transition?.[key as keyof MotiTransition<Animate>]?.delay != null) {
    delayMs = (transition[key as keyof MotiTransition<Animate>] as TransitionConfig).delay;
  } else if (transition?.delay != null) {
    delayMs = transition.delay;
  }
  return { delayMs };
}

const withSpringConfigKeys: (keyof WithSpringConfig)[] = [
  'stiffness',
  'overshootClamping',
  'velocity',
  'reduceMotion',
  'mass',
  'damping',
  'duration',
  'dampingRatio',
];

function animationConfig<Animate>(styleProp: string, transition: MotiTransition<Animate> | undefined) {
  'worklet';

  const key = styleProp as Extract<keyof Animate, string>;
  let repeatCount = 0;
  let repeatReverse = true;

  let animationType: Required<TransitionConfig>['type'] = 'spring';
  if (isColor(key) || key === 'opacity') animationType = 'timing';

  // biome-ignore lint/suspicious/noExplicitAny: per-key access on a complex transition union type — the key is dynamic and can't be narrowed statically
  const styleSpecificTransition = (transition as any)?.[key];

  if (styleSpecificTransition?.type) {
    animationType = styleSpecificTransition.type;
  } else if (transition?.type) {
    animationType = transition.type;
  }

  const loop = styleSpecificTransition?.loop ?? transition?.loop;
  if (loop != null) repeatCount = loop ? -1 : 0;

  if (styleSpecificTransition?.repeat != null) {
    repeatCount = styleSpecificTransition.repeat;
  } else if (transition?.repeat != null) {
    repeatCount = transition.repeat;
  }

  if (styleSpecificTransition?.repeatReverse != null) {
    repeatReverse = styleSpecificTransition.repeatReverse;
  } else if (transition?.repeatReverse != null) {
    repeatReverse = transition.repeatReverse;
  }

  let config: Record<string, unknown> = {};
  let reduceMotion = ReduceMotion.System;
  // biome-ignore lint/suspicious/noExplicitAny: holds withTiming/withSpring/withDecay which have incompatible signatures; any is the only practical union here
  let animation: (...args: any[]) => any = (...props) => props;

  if (animationType === 'timing') {
    const duration =
      (styleSpecificTransition as WithTimingConfig | undefined)?.duration ??
      (transition as WithTimingConfig | undefined)?.duration;
    const easing =
      (styleSpecificTransition as WithTimingConfig | undefined)?.easing ??
      (transition as WithTimingConfig | undefined)?.easing;
    const timingReduceMotion =
      (styleSpecificTransition as WithTimingConfig | undefined)?.reduceMotion ??
      (transition as WithTimingConfig | undefined)?.reduceMotion;

    if (easing) config.easing = easing;
    if (duration != null) config.duration = duration;
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
      // biome-ignore lint/suspicious/noExplicitAny: spring config key access on the transition union — narrowing would require exhaustive type guards
      const transitionConfigForKey = (transition as any)?.[configKey];
      if (configKey === 'reduceMotion') {
        if (transitionConfigForKey || styleSpecificConfig) {
          reduceMotion = transitionConfigForKey ?? styleSpecificConfig;
        }
      }
      if (styleSpecificConfig != null) {
        config[configKey] = styleSpecificConfig;
      } else if (transitionConfigForKey != null) {
        config[configKey] = transitionConfigForKey;
      }
    }
  } else if (animationType === 'decay') {
    animation = withDecay;
    config = {};
    const configKeys: (keyof WithDecayConfig)[] = [
      'clamp',
      'velocity',
      'deceleration',
      'velocityFactor',
      'reduceMotion',
    ];
    for (const configKey of configKeys) {
      const styleSpecificConfig = styleSpecificTransition?.[configKey];
      // biome-ignore lint/suspicious/noExplicitAny: spring config key access on the transition union — narrowing would require exhaustive type guards
      const transitionConfigForKey = (transition as any)?.[configKey];
      if (configKey === 'reduceMotion') {
        if (transitionConfigForKey || styleSpecificConfig) {
          reduceMotion = transitionConfigForKey ?? styleSpecificConfig;
        }
      }
      if (styleSpecificConfig != null) {
        config[configKey] = styleSpecificConfig;
      } else if (transitionConfigForKey != null) {
        config[configKey] = transitionConfigForKey;
      }
    }
  } else if (animationType === 'no-animation') {
    animation = (value: unknown) => value;
    config = {};
    repeatCount = 0;
  }

  return { animation, config, reduceMotion, repeatReverse, repeatCount, shouldRepeat: !!repeatCount };
}

const getSequenceArray = (
  sequenceKey: string,
  sequenceArray: SequenceItem<unknown>[],
  delayMs: number | undefined,
  config: Record<string, unknown>,
  animation: (...props: unknown[]) => unknown,
  callback: (completed: boolean | undefined, value: unknown, info: { attemptedSequenceValue: unknown }) => void,
) => {
  'worklet';

  const sequence: unknown[] = [];

  for (const step of sequenceArray) {
    const shouldPush =
      typeof step === 'object'
        ? step != null &&
          (step as SequenceItemObject<unknown>)?.value != null &&
          (step as SequenceItemObject<unknown>)?.value !== false
        : step != null && step !== false;

    let stepOnDidAnimate: SequenceItemObject<unknown>['onDidAnimate'];

    if (shouldPush) {
      let stepDelay = delayMs;
      let stepValue: unknown = step;
      let stepConfig = Object.assign({}, config);
      let stepAnimation = animation;

      if (typeof step === 'object' && step !== null) {
        const stepTransition = Object.assign({}, step) as Record<string, unknown>;
        delete stepTransition.delay;
        delete stepTransition.value;

        const { config: inlineStepConfig, animation: inlineAnimation } = animationConfig(
          sequenceKey,
          stepTransition as MotiTransition<unknown>,
        );

        stepConfig = Object.assign({}, stepConfig, inlineStepConfig);
        stepAnimation = inlineAnimation;
        stepOnDidAnimate = (step as SequenceItemObject<unknown>).onDidAnimate;

        if ((step as SequenceItemObject<unknown>).delay != null) {
          stepDelay = (step as SequenceItemObject<unknown>).delay as number;
        }
        stepValue = (step as SequenceItemObject<unknown>).value;
      }

      const sequenceValue = stepAnimation(stepValue, stepConfig, (completed = false, maybeValue: unknown) => {
        'worklet';
        callback(completed, maybeValue, { attemptedSequenceValue: stepValue });
        if (stepOnDidAnimate) {
          runOnJS(stepOnDidAnimate as (...args: unknown[]) => void)(completed, maybeValue, {
            attemptedSequenceItemValue: stepValue,
            attemptedSequenceArray: maybeValue,
          });
        }
      });

      if (stepDelay != null) {
        sequence.push(withDelay(stepDelay, sequenceValue as ReturnType<typeof withTiming>));
      } else {
        sequence.push(sequenceValue);
      }
    }
  }

  return sequence;
};

export function useMotify<Animate>({
  animate: animateProp,
  from: fromProp = false,
  transition: transitionProp,
  exitTransition: exitTransitionProp,
  delay: defaultDelay,
  state,
  stylePriority = 'animate',
  onDidAnimate,
  exit: exitProp,
  animateInitialState = false,
  usePresenceValue,
  presenceContext,
}: MotiProps<Animate> & {
  presenceContext?: Pick<NonNullable<PresenceContextValue>, 'custom' | 'initial'> | null;
  usePresenceValue?: ReturnType<typeof UsePresenceFn>;
}) {
  const isMounted = useSharedValue(false);
  const [isPresent, safeToUnmount] = usePresenceValue ?? [];

  const disableInitialAnimation = presenceContext?.initial === false && !animateInitialState;

  const { custom, reanimatedSafeToUnmount, reanimatedOnDidAnimate } = useMemo(
    () => ({
      custom: () => {
        'worklet';
        return presenceContext?.custom;
      },
      reanimatedSafeToUnmount: () => {
        safeToUnmount?.();
      },
      reanimatedOnDidAnimate: (...args: Parameters<NonNullable<typeof onDidAnimate>>) => {
        onDidAnimate?.(...args);
      },
    }),
    [onDidAnimate, presenceContext, safeToUnmount],
  );

  const hasExitStyle = Boolean(
    typeof exitProp === 'function' || (typeof exitProp === 'object' && exitProp && Object.keys(exitProp).length > 0),
  );

  // RNR4: useAnimatedStyle no longer accepts a dependency array —
  // dependencies are tracked automatically by the Babel/Metro plugin.
  const style = useAnimatedStyle(() => {
    const final: Record<string, unknown> & { transform: TransformsStyle['transform'] } = {
      transform: [] as TransformsStyle['transform'],
    };
    const variantStyle: Animate & WithTransition =
      (state?.__state?.value as Animate & WithTransition) || ({} as Animate & WithTransition);

    let animateStyle: Animate;

    if (animateProp && 'value' in (animateProp as object)) {
      animateStyle = ((animateProp as { value: Animate }).value || {}) as Animate;
    } else {
      animateStyle = (animateProp || {}) as Animate;
    }

    debug('style', animateStyle);

    const initialStyle = fromProp || {};
    // biome-ignore lint/suspicious/noExplicitAny: exit prop can be a style object, boolean, or a custom() factory — no single concrete type covers all three
    let exitStyle: any = exitProp || {};

    if (typeof exitStyle === 'function') {
      exitStyle = (exitStyle as (c?: unknown) => Animate)(custom());
    }

    const isExiting = !isPresent && hasExitStyle;

    let mergedStyles: Animate = {} as Animate;
    if (stylePriority === 'state') {
      mergedStyles = Object.assign({}, animateStyle, variantStyle);
    } else {
      mergedStyles = Object.assign({}, variantStyle, animateStyle);
    }

    if (!isMounted.value && !disableInitialAnimation && Object.keys(initialStyle as object).length) {
      mergedStyles = initialStyle as Animate;
    } else {
      mergedStyles = Object.assign({}, initialStyle, mergedStyles);
    }

    if (isExiting && exitStyle && typeof exitStyle !== 'boolean') {
      mergedStyles = Object.assign({}, exitStyle) as Animate;
    }

    const exitingStyleProps: Record<string, boolean> = {};
    const disabledExitStyles = new Set([
      'position',
      'zIndex',
      'borderTopStyle',
      'borderBottomStyle',
      'borderLeftStyle',
      'borderRightStyle',
      'borderStyle',
      'pointerEvents',
      'outline',
    ]);
    Object.keys(exitStyle && typeof exitStyle !== 'boolean' ? (exitStyle as object) : {}).forEach((key) => {
      if (!disabledExitStyles.has(key)) exitingStyleProps[key] = true;
    });

    let transition: MotiTransition<Animate> | undefined;
    if (transitionProp && 'value' in (transitionProp as object)) {
      transition = (transitionProp as { value: MotiTransition<Animate> }).value;
    } else {
      transition = transitionProp as MotiTransition<Animate> | undefined;
    }

    if (variantStyle.transition) {
      transition = Object.assign({}, transition, variantStyle.transition);
    }

    if (isExiting && exitTransitionProp) {
      let exitTransition: MotiTransition<Animate> | undefined;
      if (exitTransitionProp && 'value' in (exitTransitionProp as object)) {
        exitTransition = (exitTransitionProp as { value: MotiTransition<Animate> }).value;
      } else if (typeof exitTransitionProp === 'function') {
        exitTransition = (exitTransitionProp as (c?: unknown) => MotiTransition<Animate>)(custom());
      } else {
        exitTransition = exitTransitionProp as MotiTransition<Animate>;
      }
      transition = Object.assign({}, transition, exitTransition);
    }

    Object.keys(mergedStyles as object).forEach((key) => {
      let value = (mergedStyles as Record<string, unknown>)[key];

      let inlineOnDidAnimate: InlineOnDidAnimate<unknown> | undefined;

      if (typeof value === 'object' && value && 'onDidAnimate' in (value as object)) {
        inlineOnDidAnimate = (value as { onDidAnimate: InlineOnDidAnimate<unknown> }).onDidAnimate;
        value = (value as { value: unknown }).value;
      }

      const { animation, config, shouldRepeat, repeatCount, repeatReverse } = animationConfig(key, transition);

      const callback = (
        completed = false,
        recentValue: unknown,
        info?: { attemptedSequenceValue?: unknown; transformKey?: string },
      ) => {
        if (onDidAnimate) {
          runOnJS(reanimatedOnDidAnimate as (...args: unknown[]) => void)(key, completed, recentValue, {
            attemptedValue: value,
            attemptedSequenceItemValue: info?.attemptedSequenceValue,
          });
        }
        if (inlineOnDidAnimate) {
          runOnJS(inlineOnDidAnimate)(completed, recentValue, { attemptedValue: value });
        }
        if (isExiting) {
          exitingStyleProps[key] = false;
          const areStylesExiting = Object.values(exitingStyleProps).some(Boolean);
          if (!areStylesExiting) runOnJS(reanimatedSafeToUnmount)();
        }
      };

      let { delayMs } = animationDelay(key, transition, defaultDelay);

      if (value == null || value === false) return;

      if (key === 'transform') {
        if (!Array.isArray(value)) {
          console.error(`[${PackageName}]: Invalid transform value. Needs to be an array.`);
        } else {
          (value as unknown[]).forEach((transformObject) => {
            final.transform = final.transform || [];
            const transformKey = Object.keys(transformObject as object)[0] as string;
            const transformValue = (transformObject as Record<string, unknown>)[transformKey];
            const transform: Record<string, unknown> = {};

            if (Array.isArray(transformValue)) {
              const sequence = getSequenceArray(transformKey, transformValue, delayMs, config, animation, callback);
              if (sequence.length) {
                let finalValue = withSequence(
                  sequence[0] as ReturnType<typeof withTiming>,
                  ...(sequence.slice(1) as ReturnType<typeof withTiming>[]),
                );
                if (shouldRepeat) {
                  finalValue = withRepeat(finalValue, repeatCount, repeatReverse, callback);
                }
                transform[transformKey] = finalValue;
              }
            } else {
              if ((transition as Record<string, Record<string, unknown>>)?.[transformKey]?.delay != null) {
                delayMs = (transition as Record<string, Record<string, number>>)[transformKey]?.delay;
              }
              let configKey = transformKey;
              if (transition && 'transform' in (transition as object) && !(configKey in (transition as object))) {
                configKey = 'transform';
              }

              const {
                animation: tAnim,
                config: tConfig,
                shouldRepeat: tShouldRepeat,
                repeatCount: tRepeatCount,
                repeatReverse: tRepeatReverse,
              } = animationConfig(configKey, transition);

              let finalValue = tAnim(transformValue, tConfig, callback);
              if (tShouldRepeat) {
                finalValue = withRepeat(
                  finalValue as ReturnType<typeof withTiming>,
                  tRepeatCount,
                  tRepeatReverse,
                  undefined,
                );
              }
              if (delayMs != null) {
                transform[transformKey] = withDelay(delayMs, finalValue as ReturnType<typeof withTiming>);
              } else {
                transform[transformKey] = finalValue;
              }
            }

            if (Object.keys(transform).length && Array.isArray(final.transform)) {
              (final.transform as unknown[]).push(transform);
            }
          });
        }
      } else if (Array.isArray(value)) {
        const sequence = getSequenceArray(key, value, delayMs, config, animation, callback);
        let finalValue = withSequence(
          ...(sequence as [ReturnType<typeof withTiming>, ...ReturnType<typeof withTiming>[]]),
        );
        if (shouldRepeat) {
          finalValue = withRepeat(finalValue, repeatCount, repeatReverse, undefined);
        }

        if (isTransform(key)) {
          final.transform = final.transform || [];
          if (sequence.length) {
            const transform: Record<string, unknown> = {};
            transform[key] = finalValue;
            (final.transform as unknown[]).push(transform);
          }
        } else {
          if (sequence.length) final[key] = finalValue;
        }
      } else if (isTransform(key)) {
        final.transform = final.transform || [];

        if ((transition as Record<string, Record<string, unknown>>)?.[key]?.delay != null) {
          delayMs = (transition as Record<string, Record<string, number>>)[key]?.delay;
        }

        const transform: Record<string, unknown> = {};
        let finalValue = animation(value, config, callback);
        if (shouldRepeat) {
          finalValue = withRepeat(finalValue as ReturnType<typeof withTiming>, repeatCount, repeatReverse, undefined);
        }
        if (delayMs != null) {
          transform[key] = withDelay(delayMs, finalValue as ReturnType<typeof withTiming>);
        } else {
          transform[key] = finalValue;
        }
        (final.transform as unknown[]).push(transform);
      } else if (typeof value === 'object') {
        final[key] = {};
        for (const innerStyleKey in value) {
          let finalValue = animation(value, config, callback);
          if (shouldRepeat) {
            finalValue = withRepeat(finalValue as ReturnType<typeof withTiming>, repeatCount, repeatReverse, undefined);
          }
          if (delayMs != null) {
            (final[key] as Record<string, unknown>)[innerStyleKey] = withDelay(
              delayMs,
              finalValue as ReturnType<typeof withTiming>,
            );
          } else {
            (final[key] as Record<string, unknown>)[innerStyleKey] = finalValue;
          }
        }
      } else {
        let finalValue = animation(value, config, callback);
        if (shouldRepeat) {
          finalValue = withRepeat(finalValue as ReturnType<typeof withTiming>, repeatCount, repeatReverse, undefined);
        }
        if (delayMs != null && typeof delayMs === 'number') {
          final[key] = withDelay(delayMs, finalValue as ReturnType<typeof withTiming>);
        } else {
          final[key] = finalValue;
        }
      }
    });

    if (!(final.transform as unknown[])?.length) {
      delete (final as Record<string, unknown>).transform;
    }

    return final as Record<string, unknown>;
  });

  useEffect(
    function allowUnMountIfMissingExit() {
      if (fromProp && isMounted.value === false) {
        isMounted.value = true;
      }
      if (!isPresent && !hasExitStyle) {
        reanimatedSafeToUnmount();
      }
    },
    [hasExitStyle, isPresent, reanimatedSafeToUnmount, isMounted.value, isMounted, fromProp],
  );

  return { style };
}
