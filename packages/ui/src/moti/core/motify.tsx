import React, { type ComponentType, forwardRef, useContext } from 'react';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';
import Animated, {
  type BaseAnimationBuilder,
  type EntryExitAnimationFunction,
  type Keyframe,
  type LayoutAnimationFunction,
} from 'react-native-reanimated';

import { PresenceContext, usePresenceContext } from '../presence/animate-presence-context';
import type { MotiProps } from './types';
import { useMotify } from './use-motify';

type AnimatedProps<Props> = {
  animatedProps?: Partial<Props>;
  layout?: BaseAnimationBuilder | LayoutAnimationFunction | typeof BaseAnimationBuilder;
  entering?: BaseAnimationBuilder | typeof BaseAnimationBuilder | EntryExitAnimationFunction | typeof Keyframe;
  exiting?: BaseAnimationBuilder | typeof BaseAnimationBuilder | EntryExitAnimationFunction | typeof Keyframe;
};

export default function motify<Props extends object, Ref, Animate = ViewStyle | ImageStyle | TextStyle>(
  ComponentWithoutAnimation: ComponentType<Props>,
) {
  const Component = Animated.createAnimatedComponent(ComponentWithoutAnimation);

  const withAnimations = () => {
    // biome-ignore lint/suspicious/noReactForwardRef: package targets React >=18 where forwardRef is required; ref-as-prop is React 19+ only
    const Motified = forwardRef<
      Ref,
      Props &
        AnimatedProps<Props> &
        MotiProps<Animate> & {
          children?: React.ReactNode;
          style?: unknown;
        }
    >(function Moti(props, ref) {
      const animated = useMotify({
        ...props,
        usePresenceValue: usePresenceContext(),
        presenceContext: useContext(PresenceContext),
      });

      const style = props.style;

      return (
        // biome-ignore lint/suspicious/noExplicitAny: animated component props and ref don't unify cleanly across RN/Reanimated generic types
        // biome-ignore lint/plugin: props/ref can't unify across RN/Reanimated generic types; the any cast above is the only bridge
        <Component {...(props as any)} style={style ? [style, animated.style] : animated.style} ref={ref as any} />
      );
    });

    Motified.displayName = `Moti.${ComponentWithoutAnimation.displayName || ComponentWithoutAnimation.name || 'NoName'}`;

    return Motified;
  };

  return withAnimations;
}
