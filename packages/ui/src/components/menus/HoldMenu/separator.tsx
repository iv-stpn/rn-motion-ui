import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useHoldMenuInternal } from './hold-menu-context';
import { BORDER_DARK_COLOR, BORDER_LIGHT_COLOR } from './hold-menu-theme';

const styles = StyleSheet.create({
  separator: {
    width: '100%',
    height: 8,
  },
});

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

  return <Animated.View style={[styles.separator, separatorStyles]} />;
};

export const Separator = memo(SeparatorComponent);
