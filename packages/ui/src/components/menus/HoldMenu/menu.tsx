import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { CONTEXT_MENU_STATE, HOLD_ITEM_TRANSFORM_DURATION, SPRING_CONFIGURATION } from './hold-menu-constants';
import { useHoldMenuInternal } from './hold-menu-context';
import { SPACING } from './hold-menu-style-guide';
import { MenuList } from './menu-list';

const styles = StyleSheet.create({
  menuWrapper: {
    position: 'absolute',
    left: 0,
    zIndex: 10,
  },
});

/**
 * The menu's positioning wrapper — upstream's `Menu`. Anchored at the held
 * item's rect from `menuProps` (below the item for `top-*` anchors, above for
 * `bottom-*`), it carries the vertical travel: when the item and panel move up
 * or down together to fit on screen, the wrapper's `translateY` springs to the
 * stored `transformValue` while the menu is active and times back to 0 on
 * close. The panel itself lives inside ({@link MenuList}).
 */
const MenuComponent = () => {
  const { state, menuProps, reducedMotion } = useHoldMenuInternal();

  const wrapperStyles = useAnimatedStyle(() => {
    const anchorPositionVertical = menuProps.value.anchorPosition.split('-')[0];

    const top =
      anchorPositionVertical === 'top'
        ? menuProps.value.itemHeight + menuProps.value.itemY + SPACING
        : menuProps.value.itemY - SPACING;
    const left = menuProps.value.itemX;
    const width = menuProps.value.itemWidth;
    const tY = menuProps.value.transformValue;
    const duration = reducedMotion.value === 1 ? 0 : HOLD_ITEM_TRANSFORM_DURATION;

    // The pair travels while active — spring there (or snap, reduced motion) —
    // and times back to rest on close.
    const travelAnimation = () => {
      if (state.value !== CONTEXT_MENU_STATE.ACTIVE) return withTiming(0, { duration });
      if (reducedMotion.value === 1) return withTiming(tY, { duration: 0 });
      return withSpring(tY, SPRING_CONFIGURATION);
    };

    return {
      top,
      left,
      width,
      transform: [{ translateY: travelAnimation() }],
    };
  }, [menuProps]);

  return (
    <Animated.View style={[styles.menuWrapper, wrapperStyles]}>
      <MenuList />
    </Animated.View>
  );
};

export const Menu = memo(MenuComponent);
