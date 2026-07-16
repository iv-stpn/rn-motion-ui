import type React from 'react';
import { forwardRef } from 'react';
import Animated from 'react-native-reanimated';

import type { ExcludeFunctionKeys, MotiProps } from '../core/types';
import { useMotify } from '../core/use-motify';

type AdditionalProps = {
  children?: React.ReactNode;
  /**
   * Animated props are not allowed with a Moti SVG component — they will be
   * overridden. Use the `animate` prop (or a derived value) instead.
   */
  animatedProps?: never;
};

export function motifySvg<
  C extends React.ComponentClass<object>,
  Props = React.ComponentPropsWithoutRef<C>,
  Animate = ExcludeFunctionKeys<Omit<Props, 'children'>>,
>(ComponentWithoutAnimation: C) {
  const withAnimations = () => {
    const AnimatedComponent = Animated.createAnimatedComponent(
      ComponentWithoutAnimation as unknown as React.ComponentType<object>,
    );

    const Motified = forwardRef<React.ElementRef<C>, Props & MotiProps<Animate> & AdditionalProps>(
      function Moti(props, _ref) {
        const animated = useMotify<Animate>(props as MotiProps<Animate>);

        if ((props as AdditionalProps).animatedProps !== undefined) {
          console.warn(
            `Moti: You passed animatedProps to a Moti SVG component. This will have no effect. Use the animate prop instead.`,
          );
        }

        return <AnimatedComponent {...(props as object)} animatedProps={animated.style} />;
      },
    );

    Motified.displayName = `MotiSvg.${
      ComponentWithoutAnimation.displayName || ComponentWithoutAnimation.name || 'NoName'
    }`;

    return Motified;
  };

  return withAnimations;
}
