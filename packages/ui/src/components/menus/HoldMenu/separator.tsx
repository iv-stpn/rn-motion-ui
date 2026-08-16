import { memo } from 'react';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useHoldMenuInternal } from './context';
import { BORDER_DARK_COLOR, BORDER_LIGHT_COLOR } from './hold-menu-theme';

/**
 * The 8 px band between menu groups — upstream's `Separator`, colored by theme.
 */
const SeparatorComponent = () => {
  const { theme } = useHoldMenuInternal();

  const separatorStyles = useAnimatedStyle(
    () => ({
      backgroundColor: theme.value === 'dark' ? BORDER_DARK_COLOR : BORDER_LIGHT_COLOR,
    }),
    [theme],
  );

  return <Animated.View className="h-2 w-full" style={separatorStyles} />;
};

export const Separator = memo(SeparatorComponent);
