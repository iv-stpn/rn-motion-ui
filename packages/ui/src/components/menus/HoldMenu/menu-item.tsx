import { memo, type ReactNode, useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { CONTEXT_MENU_STATE } from './hold-menu-constants';
import { useHoldMenuInternal } from './hold-menu-context';
import { getColor, isMenuItemEqual } from './hold-menu-layout';
import { BORDER_DARK_COLOR, BORDER_LIGHT_COLOR } from './hold-menu-theme';
import type { MenuItemProps } from './hold-menu-types';
import { Separator } from './separator';

const AnimatedTouchable = Animated.createAnimatedComponent(Pressable);

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

type MenuItemComponentProps = {
  item: MenuItemProps;
  isLast?: boolean;
  /** Base testID of the item that opened the menu — rows derive `${testID}-menu-item-<text>`. */
  testID?: string;
};

/**
 * One row of the menu — upstream's `MenuItem`: a themed pressable with a
 * border below it (none on the last row), text colored by
 * `isTitle` / `isDestructive` / theme, an icon rendered through the provider's
 * `AnimatedIcon` (string) or the item's own render function, and an `onPress`
 * that receives the item's `actionParams` entry spread as arguments and then
 * closes the menu. Title rows are inert captions.
 */
const MenuItemComponent = ({ item, isLast, testID }: MenuItemComponentProps) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, item, menuProps]);

  // Resolved to a variable before the return (noLeakedRender): a string icon
  // renders through the provider's AnimatedIcon, a function icon calls itself.
  let iconElement: ReactNode = null;
  if (!item.isTitle && item.icon) {
    if (typeof item.icon === 'string' && AnimatedIcon)
      iconElement = <AnimatedIcon name={item.icon} size={18} style={textColor} />;
    else if (typeof item.icon === 'function') iconElement = item.icon();
  }

  return (
    <>
      <AnimatedTouchable
        accessibilityLabel={item.text}
        accessibilityRole="button"
        onPress={handleOnPress}
        style={[styles.menuItem, borderStyles]}
        testID={testID ? `${testID}-menu-item-${item.text}` : undefined}
      >
        <Animated.Text style={[item.isTitle ? styles.menuItemTitleText : styles.menuItemText, textColor]}>
          {item.text}
        </Animated.Text>
        {iconElement}
      </AnimatedTouchable>
      {item.withSeparator ? <Separator /> : null}
    </>
  );
};

export const MenuItem = memo(
  MenuItemComponent,
  (prev, next) => prev.isLast === next.isLast && prev.testID === next.testID && isMenuItemEqual(prev.item, next.item),
);
