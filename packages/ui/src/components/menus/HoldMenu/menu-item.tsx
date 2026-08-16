import { memo, type ReactNode, useCallback } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { CONTEXT_MENU_STATE } from './constants';
import { useHoldMenuInternal } from './context';
import { BORDER_DARK_COLOR, BORDER_LIGHT_COLOR } from './hold-menu-theme';
import type { MenuItemProps } from './hold-menu-types';
import { getColor } from './layout';
import { Separator } from './separator';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const styles = StyleSheet.create({
  menuItem: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  menuItemText: {
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'left',
    width: '100%',
    flex: 1,
  },
  menuItemTitleText: {
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
    width: '100%',
    flex: 1,
  },
});

type MenuItemComponentProps = { item: MenuItemProps; isLast?: boolean };

/**
 * One row of the menu — upstream's `MenuItem`: a themed pressable with a border
 * below it (none on the last row), text colored by `isTitle` / `isDestructive`
 * / theme, an icon rendered through the provider's `AnimatedIcon` (string) or
 * the item's own render function, and an `onPress` that receives the item's
 * `actionParams` entry spread as arguments and then closes the menu. Title rows
 * are inert captions.
 */
const MenuItemComponent = ({ item, isLast }: MenuItemComponentProps) => {
  const { state, theme, menuProps, AnimatedIcon } = useHoldMenuInternal();

  const borderStyles = useAnimatedStyle(() => {
    const borderBottomColor = theme.value === 'dark' ? BORDER_DARK_COLOR : BORDER_LIGHT_COLOR;

    return {
      borderBottomColor,
      borderBottomWidth: isLast ? 0 : 1,
    };
  }, [theme, isLast, item]);

  const textColor = useAnimatedStyle(() => ({ color: getColor(item.isTitle, item.isDestructive, theme.value) }), [theme, item]);

  const handleOnPress = useCallback(() => {
    if (!item.isTitle) {
      const params = menuProps.value.actionParams[item.text] || [];
      if (item.onPress) item.onPress(...params);
      state.value = CONTEXT_MENU_STATE.END;
    }
  }, [state, item, menuProps]);

  let iconElement: ReactNode = null;
  if (!item.isTitle && item.icon) {
    if (typeof item.icon === 'string' && AnimatedIcon)
      iconElement = <AnimatedIcon name={item.icon} size={18} style={textColor} />;
    else if (typeof item.icon === 'function') iconElement = item.icon();
  }

  return (
    <>
      <AnimatedTouchable onPress={handleOnPress} activeOpacity={item.isTitle ? 1 : 0.4} style={[styles.menuItem, borderStyles]}>
        <Animated.Text style={[item.isTitle ? styles.menuItemTitleText : styles.menuItemText, textColor]}>
          {item.text}
        </Animated.Text>
        {iconElement}
      </AnimatedTouchable>
      {item.withSeparator ? <Separator /> : null}
    </>
  );
};

export const MenuItem = memo(MenuItemComponent);
