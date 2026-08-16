import { memo, useState } from 'react';
import { ScrollView } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { CONTEXT_MENU_STATE, HOLD_ITEM_TRANSFORM_DURATION, MENU_WIDTH_RATIO, SPRING_CONFIGURATION_MENU } from './constants';
import { useHoldMenuInternal } from './context';
import { MENU_PANEL_DARK_COLOR, MENU_PANEL_LIGHT_COLOR } from './hold-menu-theme';
import type { MenuItemProps } from './hold-menu-types';
import { clampMenuLeft, deepEqual, leftOrRight, menuAnimationAnchor } from './layout';
import { MenuItems } from './menu-items';

/**
 * The panel — upstream's `MenuList`: the translucent surface that
 * pops out of the corner nearest the held item.
 *
 * The panel's width is upstream's 60% of the window, computed rotation-safely
 * from the provider's `windowSize` shared value (upstream reads `MENU_WIDTH`
 * from `Dimensions` at import time, which goes stale on rotation). Its height
 * is the effective `menuHeight` the activating `HoldItem` stored — already
 * capped to the room left after travel — so a menu taller than the viewport
 * scrolls instead of running off the screen, and its absolute left is clamped
 * into the safe viewport. Item rows cross into React state through the same
 * `useAnimatedReaction` + `deepEqual` sync upstream uses.
 */
const MenuListComponent = () => {
  const { state, theme, menuProps, windowSize, safeAreaInsets } = useHoldMenuInternal();

  const [itemList, setItemList] = useState<MenuItemProps[]>([]);
  const prevList = useSharedValue<MenuItemProps[]>([]);

  const messageStyles = useAnimatedStyle(() => {
    const menuWidth = Math.round(windowSize.value.width * MENU_WIDTH_RATIO);

    const translate = menuAnimationAnchor(
      menuProps.value.anchorPosition,
      menuProps.value.itemWidth,
      menuProps.value.menuHeight,
      menuWidth,
    );

    const left = clampMenuLeft({
      left: menuProps.value.itemX + leftOrRight(menuProps.value.anchorPosition, menuProps.value.itemWidth, menuWidth),
      menuWidth,
      windowWidth: windowSize.value.width,
      safeLeft: safeAreaInsets.value.left,
      safeRight: safeAreaInsets.value.right,
    });

    const menuScaleAnimation = () =>
      state.value === CONTEXT_MENU_STATE.ACTIVE
        ? withSpring(1, SPRING_CONFIGURATION_MENU)
        : withTiming(0, { duration: HOLD_ITEM_TRANSFORM_DURATION });

    const opacityAnimation = () =>
      withTiming(state.value === CONTEXT_MENU_STATE.ACTIVE ? 1 : 0, { duration: HOLD_ITEM_TRANSFORM_DURATION });

    return {
      left,
      width: menuWidth,
      height: menuProps.value.menuHeight,
      opacity: opacityAnimation(),
      transform: [
        { translateX: translate.beginningTransformations.translateX },
        { translateY: translate.beginningTransformations.translateY },
        { scale: menuScaleAnimation() },
        { translateX: translate.endingTransformations.translateX },
        { translateY: translate.endingTransformations.translateY },
      ],
    };
  }, [menuProps, windowSize, safeAreaInsets]);

  const animatedInnerContainerStyle = useAnimatedStyle(
    () => ({
      backgroundColor: theme.value === 'light' ? MENU_PANEL_LIGHT_COLOR : MENU_PANEL_DARK_COLOR,
    }),
    [theme],
  );

  const setter = (items: MenuItemProps[]) => {
    setItemList(items);
    prevList.value = items;
  };

  useAnimatedReaction(
    () => menuProps.value.items,
    (_items) => {
      if (!deepEqual(_items, prevList.value)) runOnJS(setter)(_items);
    },
    [menuProps],
  );

  return (
    <Animated.View
      className="absolute top-0 z-[15] flex-row items-start justify-start overflow-hidden rounded-xl"
      style={messageStyles}
    >
      <Animated.View className="absolute inset-0 flex-col items-center justify-start" style={animatedInnerContainerStyle}>
        <ScrollView bounces={false} showsVerticalScrollIndicator={false} className="absolute inset-0">
          <MenuItems items={itemList} />
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
};

export const MenuList = memo(MenuListComponent);
