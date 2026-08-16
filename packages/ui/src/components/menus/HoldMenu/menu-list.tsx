import { memo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { HoldMenuBlur } from './hold-menu-blur';
import {
  CONTEXT_MENU_STATE,
  HOLD_ITEM_TRANSFORM_DURATION,
  MENU_WIDTH_RATIO,
  SPRING_CONFIGURATION_MENU,
} from './hold-menu-constants';
import { useHoldMenuInternal } from './hold-menu-context';
import { clampMenuLeft, deepEqual, leftOrRight, menuAnimationAnchor } from './hold-menu-layout';
import { MENU_PANEL_DARK_COLOR, MENU_PANEL_LIGHT_COLOR } from './hold-menu-theme';
import type { MenuItemProps } from './hold-menu-types';
import { MenuItems } from './menu-items';

const styles = StyleSheet.create({
  menuContainer: {
    position: 'absolute',
    top: 0,
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    overflow: 'hidden',
    zIndex: 15,
  },
  menuInnerContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
});

/**
 * The panel — upstream's `MenuList`: the blurred, translucent surface that
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
  const { state, theme, menuProps, windowSize, safeAreaInsets, reducedMotion } = useHoldMenuInternal();

  const [itemList, setItemList] = useState<MenuItemProps[]>([]);
  const [activeTestID, setActiveTestID] = useState<string | undefined>(undefined);
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

    const duration = reducedMotion.value === 1 ? 0 : HOLD_ITEM_TRANSFORM_DURATION;

    // The panel pops in while active — spring there (or snap, reduced motion) —
    // and times back to zero on close.
    const scaleAnimation = () => {
      if (state.value !== CONTEXT_MENU_STATE.ACTIVE) return withTiming(0, { duration });
      if (reducedMotion.value === 1) return withTiming(1, { duration: 0 });
      return withSpring(1, SPRING_CONFIGURATION_MENU);
    };

    const opacityAnimation = () =>
      withTiming(state.value === CONTEXT_MENU_STATE.ACTIVE ? 1 : 0, {
        duration,
        easing: Easing.out(Easing.cubic),
      });

    return {
      left,
      width: menuWidth,
      height: menuProps.value.menuHeight,
      opacity: opacityAnimation(),
      transform: [
        { translateX: translate.beginningTransformations.translateX },
        { translateY: translate.beginningTransformations.translateY },
        { scale: scaleAnimation() },
        { translateX: translate.endingTransformations.translateX },
        { translateY: translate.endingTransformations.translateY },
      ],
    };
  }, [menuProps, windowSize, safeAreaInsets, reducedMotion]);

  const animatedInnerContainerStyle = useAnimatedStyle(
    () => ({
      backgroundColor: theme.value === 'light' ? MENU_PANEL_LIGHT_COLOR : MENU_PANEL_DARK_COLOR,
    }),
    [theme],
  );

  const animatedProps = useAnimatedProps(() => ({ tint: theme.value }), [theme]);

  const setter = (items: MenuItemProps[]) => {
    setItemList(items);
    // `testID` lands in the same `menuProps` write that carried the items, so
    // reading it here keeps the panel testIDs in step with the row list.
    setActiveTestID(menuProps.value.testID);
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
    <HoldMenuBlur
      animatedProps={animatedProps}
      style={[styles.menuContainer, messageStyles]}
      testID={activeTestID ? `${activeTestID}-panel` : undefined}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.menuInnerContainer, animatedInnerContainerStyle]}>
        <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={StyleSheet.absoluteFill}>
          <MenuItems items={itemList} testID={activeTestID} />
        </ScrollView>
      </Animated.View>
    </HoldMenuBlur>
  );
};

export const MenuList = memo(MenuListComponent);
