import { scheduleOnRN } from 'react-native-worklets';
import type { InlineOnDidAnimate } from '../types';

type MakeAnimationCallbackOptions = {
  key: string;
  value: unknown;
  inlineOnDidAnimate: InlineOnDidAnimate<unknown> | undefined;
  isExiting: boolean;
  exitingStyleProps: Record<string, boolean>;
  hasOnDidAnimate: boolean;
  reanimatedOnDidAnimate: (...args: unknown[]) => void;
  reanimatedSafeToUnmount: () => void;
};

export type AnimationCallbackInfo = { attemptedSequenceValue?: unknown; transformKey?: string };

/**
 * Builds the per-style-key animation callback that bridges back to JS
 * (onDidAnimate / inline onDidAnimate) and gates the presence unmount.
 */
export function makeAnimationCallback({
  key,
  value,
  inlineOnDidAnimate,
  isExiting,
  exitingStyleProps,
  hasOnDidAnimate,
  reanimatedOnDidAnimate,
  reanimatedSafeToUnmount,
}: MakeAnimationCallbackOptions) {
  'worklet';

  // biome-ignore lint/style/useDefaultParameterLast: Reanimated animation-callback contract is (finished = false, current) — parameter order is fixed by the framework.
  return (completed = false, recentValue: unknown, info?: AnimationCallbackInfo) => {
    'worklet';
    if (hasOnDidAnimate)
      // biome-ignore lint/plugin: runOnJS needs a concrete parameter list; the memoized callback's variadic Parameters<> type isn't expressible here
      scheduleOnRN(reanimatedOnDidAnimate as (...args: unknown[]) => void, key, completed, recentValue, {
        attemptedValue: value,
        attemptedSequenceItemValue: info?.attemptedSequenceValue,
      });
    if (inlineOnDidAnimate) scheduleOnRN(inlineOnDidAnimate, completed, recentValue, { attemptedValue: value });
    if (isExiting) {
      exitingStyleProps[key] = false;
      const areStylesExiting = Object.values(exitingStyleProps).some(Boolean);
      if (!areStylesExiting) scheduleOnRN(reanimatedSafeToUnmount);
    }
  };
}
