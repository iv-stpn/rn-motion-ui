import { memo, type ReactNode, useCallback } from 'react';
import { TouchableOpacity } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { CONTEXT_MENU_STATE } from './constants';
import { useHoldMenuInternal } from './context';
import { BORDER_DARK_COLOR, BORDER_LIGHT_COLOR } from './hold-menu-theme';
import type { MenuItemProps } from './hold-menu-types';
import { getColor } from './layout';
import { Separator } from './separator';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/** Static row/text classes — the animated border and text colour ride in `style`. */
const MENU_ITEM_CLASS = 'w-full flex-row items-center justify-between px-4 py-2.5';
const MENU_ITEM_TEXT_CLASS = 'w-full flex-1 text-left text-base leading-5';
const MENU_ITEM_TITLE_TEXT_CLASS = 'w-full flex-1 text-center text-sm leading-[18px]';

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
      <AnimatedTouchable
        onPress={handleOnPress}
        activeOpacity={item.isTitle ? 1 : 0.4}
        className={MENU_ITEM_CLASS}
        style={borderStyles}
      >
        <Animated.Text className={item.isTitle ? MENU_ITEM_TITLE_TEXT_CLASS : MENU_ITEM_TEXT_CLASS} style={textColor}>
          {item.text}
        </Animated.Text>
        {iconElement}
      </AnimatedTouchable>
      {item.withSeparator ? <Separator /> : null}
    </>
  );
};

export const MenuItem = memo(MenuItemComponent);
