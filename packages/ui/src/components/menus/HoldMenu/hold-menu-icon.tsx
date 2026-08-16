import { type ComponentType, memo } from 'react';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import { useHoldMenuInternal } from './hold-menu-context';
import type { HoldMenuIconComponent as HoldMenuIconComponentType } from './hold-menu-types';

type IconComponentProps = { name: string; size: number; animatedProps: Partial<{ color: string }> };

type HoldMenuIconProps = {
  /** Vector-icon-like component mapping a `name` to an element. */
  iconComponent: HoldMenuIconComponentType;
  /** Icon name to render. */
  name: string;
};

/**
 * `HoldMenuIcon` — upstream's `Icon`, the exported adapter for rendering a
 * single themed menu icon outside the item list. The color is animated from
 * the current menu theme (`black` in light, `white` in dark) through
 * `useAnimatedProps`, at upstream's fixed size of 18.
 */
const HoldMenuIconView = ({ iconComponent, name }: HoldMenuIconProps) => {
  const { theme } = useHoldMenuInternal();
  // biome-ignore lint/plugin: createAnimatedComponent resolves the icon to its props type — the cast keeps the { name, size, animatedProps } contract
  const AnimatedIcon = Animated.createAnimatedComponent(iconComponent) as ComponentType<IconComponentProps>;

  const iconProps = useAnimatedProps(
    () => ({
      color: theme.value === 'light' ? 'black' : 'white',
    }),
    [theme],
  );

  return <AnimatedIcon name={name} size={18} animatedProps={iconProps} />;
};

export const HoldMenuIcon = memo(HoldMenuIconView);
