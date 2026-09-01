import { memo } from 'react';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { CONTEXT_MENU_STATE, HOLD_ITEM_TRANSFORM_DURATION, SPRING_CONFIGURATION } from './constants';
import { useHoldMenuInternal } from './context';
import { MenuList } from './menu-list';
import { SPACING } from './style-guide';

/**
 * The menu's positioning wrapper — upstream's `Menu`. It anchors the panel
 * vertically (below the item for `top-*` anchors, above for `bottom-*`) and
 * carries the vertical travel: when the item and panel move up or down
 * together to fit on screen, the wrapper's `translateY` springs to the stored
 * `transformValue` while the menu is active and times back to 0 on close.
 *
 * Horizontal placement is NOT this wrapper's job — the panel inside
 * ({@link MenuList}) positions itself with an absolute `left` derived from the
 * item rect, so this wrapper stays at `left: 0` (the stylesheet default).
 */
const MenuComponent = () => {
  const { state, menuProps, rootPageX, rootPageY, teleported } = useHoldMenuInternal();

  const wrapperStyles = useAnimatedStyle(() => {
    const anchorPositionVertical = menuProps.value.anchorPosition.split('-')[0];

    // `top`/`left` are root-space (the activation worklet subtracts the root's
    // page offset from the item's page coords). When the overlay is teleported to
    // the `BlurProvider` overlay host its containing block is the window, not the
    // root, so add the root's page offset back to land where the panel would have
    // inside the root.
    const offsetX = teleported ? rootPageX.value : 0;
    const offsetY = teleported ? rootPageY.value : 0;

    const top =
      (anchorPositionVertical === 'top'
        ? menuProps.value.itemHeight + menuProps.value.itemY + SPACING
        : menuProps.value.itemY - SPACING) + offsetY;
    const tY = menuProps.value.transformValue;

    // The panel's `left` is absolute in the root's space (item-relative offset
    // applied in `MenuList`), so the wrapper must not also offset by `itemX` —
    // doing so would double-count the item's x and push a right-anchored panel
    // (e.g. a `fromMe` chat bubble) past the right edge by the item's own x. The
    // only horizontal offset it carries is the teleport root-space correction.
    return {
      top,
      left: offsetX,
      transform: [
        {
          translateY:
            state.value === CONTEXT_MENU_STATE.ACTIVE
              ? withSpring(tY, SPRING_CONFIGURATION)
              : withTiming(0, { duration: HOLD_ITEM_TRANSFORM_DURATION }),
        },
      ],
    };
  }, [menuProps, rootPageX, rootPageY, teleported]);

  return (
    <Animated.View className="absolute z-10" style={wrapperStyles}>
      <MenuList />
    </Animated.View>
  );
};

export const Menu = memo(MenuComponent);
