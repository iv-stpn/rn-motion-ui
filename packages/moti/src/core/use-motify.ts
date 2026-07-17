import { hasKey } from '@rn-motion-ui/utils/typeguards';
import { useEffect, useMemo } from 'react';
import type { TransformsStyle } from 'react-native';
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import type { PresenceContextValue, usePresenceContext } from '../presence/animate-presence-context';
import type { InlineOnDidAnimate, MotiProps, WithTransition } from './types';
import { applyStyleKey } from './worklets/apply-style-key';
import { buildExitingStyleProps, buildMergedStyles } from './worklets/build-style';
import { debug } from './worklets/debug';
import { makeAnimationCallback } from './worklets/make-animation-callback';
import { resolveSharedOrPlain } from './worklets/resolve-shared-value';
import { resolveTransition } from './worklets/resolve-transition';

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: useMotify orchestrates the full animation lifecycle (animate/from/exit/state/presence) — the remaining lines are setup and a single style-key loop; further splitting would require passing shared worklet references across function boundaries
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
  usePresenceValue?: ReturnType<typeof usePresenceContext>;
}) {
  const isMounted = useSharedValue(false);
  const [isPresent, safeToUnmount] = usePresenceValue ?? [];

  const disableInitialAnimation = presenceContext?.initial === false && !animateInitialState;

  const { custom, reanimatedSafeToUnmount, reanimatedOnDidAnimate } = useMemo(
    () => ({
      custom: () => presenceContext?.custom,
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
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: useAnimatedStyle orchestrates the full animation lifecycle (animate/from/exit/state/presence) — the remaining complexity is setup and a single style-key loop; further splitting would require passing shared worklet references across function boundaries
  const style = useAnimatedStyle(() => {
    const final: Record<string, unknown> & { transform: TransformsStyle['transform'] } = { transform: [] };

    const variantStyle: Animate & WithTransition =
      // biome-ignore lint/plugin: SharedValue/DerivedValue holds `unknown`, and the opaque generic Animate fallback can't be produced without assertions
      (state?.__state?.value as Animate & WithTransition) || ({} as Animate & WithTransition);

    // biome-ignore lint/plugin: opaque generic Animate with a `|| {}` fallback can't be produced without an assertion
    const animateStyle = (resolveSharedOrPlain<Animate>(animateProp as { value?: Animate } | Animate | undefined) ??
      {}) as Animate;

    debug('style', animateStyle);

    // biome-ignore lint/suspicious/noExplicitAny: exit prop can be a style object, boolean, or a custom() factory — no single concrete type covers all three
    let exitStyle: any = exitProp ?? {};
    if (typeof exitStyle === 'function') exitStyle = exitStyle(custom());

    const isExiting = !isPresent && hasExitStyle;

    const initialStyle = typeof fromProp === 'object' ? fromProp : {};
    const mergedStyles = buildMergedStyles<Animate>({
      animateStyle,
      variantStyle,
      initialStyle,
      exitStyle,
      stylePriority,
      isMounted: isMounted.value,
      disableInitialAnimation,
      isExiting,
    });

    const exitingStyleProps = buildExitingStyleProps(exitStyle);

    const transition = resolveTransition<Animate>({
      transitionProp,
      variantTransition: variantStyle.transition,
      exitTransitionProp,
      isExiting,
      custom,
    });

    // biome-ignore lint/plugin: iterating the resolved style bag by runtime key — the opaque Animate generic has no string index signature, so it's erased to a record
    const mergedStylesRecord = mergedStyles as Record<string, unknown>;
    for (const key of Object.keys(mergedStylesRecord)) {
      let value = mergedStylesRecord[key];

      let inlineOnDidAnimate: InlineOnDidAnimate<unknown> | undefined;

      if (typeof value === 'object' && value && hasKey('onDidAnimate', value)) {
        // biome-ignore lint/plugin: `in`-narrowed to an object carrying onDidAnimate; the callback's concrete signature can't be recovered from `unknown`
        inlineOnDidAnimate = value.onDidAnimate as InlineOnDidAnimate<unknown>;
        // biome-ignore lint/plugin: reading the sibling `value` field off the same inline-callback object, which has no static index signature
        value = (value as Record<string, unknown>).value;
      }

      // biome-ignore lint/style/noContinue: guard clause skipping null/false style values at the top of the style-key loop
      if (value === null || value === undefined || value === false) continue;

      const callback = makeAnimationCallback({
        key,
        value,
        inlineOnDidAnimate,
        isExiting,
        exitingStyleProps,
        hasOnDidAnimate: Boolean(onDidAnimate),
        // biome-ignore lint/plugin: Parameters<NonNullable<typeof onDidAnimate>> is a concrete overloaded signature; (...args: unknown[]) => void is the only callable union compatible with runOnJS
        reanimatedOnDidAnimate: reanimatedOnDidAnimate as (...args: unknown[]) => void,
        reanimatedSafeToUnmount,
      });

      // biome-ignore lint/plugin: transition is MotiTransition<Animate>; applyStyleKey erases the generic to unknown since all per-key dispatch is dynamic
      applyStyleKey({ final, key, value, transition: transition as never, defaultDelay, callback });
    }

    // biome-ignore lint/performance/noDelete: must remove the transform key entirely (not set to undefined) so Reanimated doesn't apply an empty transform array.
    // biome-ignore lint/plugin: deleting the required `transform` key needs the erased Record view, since it isn't optional on the intersection type
    if (!final.transform?.length) delete (final as Record<string, unknown>).transform;

    // biome-ignore lint/plugin: worklet returns the erased style bag; the caller (createAnimatedComponent style prop) expects Record<string, unknown>, not the intersection type
    return final as Record<string, unknown>;
  });

  // biome-ignore lint/plugin: presence unmount gate — must set isMounted.value and call safeToUnmount() as a side effect after the animated style is committed
  useEffect(
    function allowUnMountIfMissingExit() {
      if (fromProp && isMounted.value === false) isMounted.value = true;
      if (!(isPresent || hasExitStyle)) reanimatedSafeToUnmount();
    },
    [hasExitStyle, isPresent, reanimatedSafeToUnmount, isMounted.value, isMounted, fromProp],
  );

  return { style };
}
