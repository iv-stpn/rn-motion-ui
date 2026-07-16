import React, { type ComponentType, type FunctionComponent, forwardRef, useContext } from 'react';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';
import Animated, {
  type BaseAnimationBuilder,
  type EntryExitAnimationFunction,
  type Keyframe,
  type LayoutAnimationFunction,
} from 'react-native-reanimated';

import { PresenceContext, usePresence } from '../presence/AnimatePresence';
import type { MotiProps } from './types';
import { useMotify } from './use-motify';

export default function motify<Props extends object, Ref, Animate = ViewStyle | ImageStyle | TextStyle>(
  ComponentWithoutAnimation: ComponentType<Props>,
) {
  const Component = Animated.createAnimatedComponent(ComponentWithoutAnimation as FunctionComponent<Props>);

  const withAnimations = () => {
    const Motified = forwardRef<
      Ref,
      Props &
        AnimatedProps<Props> &
        MotiProps<Animate> & {
          children?: React.ReactNode;
        }
    >(function Moti(props, ref) {
      const animated = useMotify({
        ...props,
        usePresenceValue: usePresence(),
        presenceContext: useContext(PresenceContext),
      });

      const style = (props as Record<string, unknown>).style;

      return (
        // biome-ignore lint/suspicious/noExplicitAny: animated component props and ref don't unify cleanly across RN/Reanimated generic types
        <Component {...(props as any)} style={style ? [style, animated.style] : animated.style} ref={ref as any} />
      );
    });

    Motified.displayName = `Moti.${
      ComponentWithoutAnimation.displayName || ComponentWithoutAnimation.name || 'NoName'
    }`;

    return Motified;
  };

  return withAnimations;
}

type AnimatedProps<Props> = {
  animatedProps?: Partial<Props>;
  layout?: BaseAnimationBuilder | LayoutAnimationFunction | typeof BaseAnimationBuilder;
  entering?: BaseAnimationBuilder | typeof BaseAnimationBuilder | EntryExitAnimationFunction | typeof Keyframe;
  exiting?: BaseAnimationBuilder | typeof BaseAnimationBuilder | EntryExitAnimationFunction | typeof Keyframe;
};
