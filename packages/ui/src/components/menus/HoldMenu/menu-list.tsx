import { memo, useCallback, useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Menu, type MenuEntry } from '../../rows/menu';
import type { MenuItemIcon } from '../../rows/menu-item';
import { CONTEXT_MENU_STATE, HOLD_ITEM_TRANSFORM_DURATION, SPRING_CONFIGURATION_MENU } from './constants';
import { useHoldMenuInternal } from './context';
import { MENU_PANEL_DARK_COLOR, MENU_PANEL_LIGHT_COLOR } from './hold-menu-theme';
import type { HoldMenuIconComponent, MenuItemProps } from './hold-menu-types';
import { deepEqual, menuAnimationAnchor, resolveMenuPanelLeft } from './layout';

/**
 * The leading icon for a `MenuItemProps` row, as a `Menu` `MenuItemIcon`.
 *
 * A consumer-supplied function icon renders itself — `HoldMenu` threads no
 * colour into function icons, so it is called with no arguments. A string name
 * is looked up through the provider's `AnimatedIcon`, sized by the row and
 * painted with the themed colour the `Menu` row already resolved (`props` is the
 * `IconProps` `MenuItem`'s default variant hands its icon).
 */
function toMenuIcon(icon: MenuItemProps['icon'], AnimatedIcon: HoldMenuIconComponent | null): MenuItemIcon | undefined {
  if (!icon) return;
  if (typeof icon === 'function') return () => icon();
  if (!AnimatedIcon) return;
  const name = icon;
  return (props) => <AnimatedIcon color={props.color} name={name} size={props.size} />;
}

/**
 * `HoldMenu`'s `MenuItemProps` list, mapped onto the generic `Menu`'s entries.
 *
 * The row is now the generic `Menu`'s — the source of truth for the menu design
 * — so `HoldMenu` translates its own item shape onto `Menu`'s: a title becomes a
 * `label` caption, a destructive flag the `destructive` row, `withSeparator` a
 * trailing `separator` entry, and `onPress` an `onSelect` that spreads the
 * item's `actionParams` entry and then closes. The close itself is the `Menu`'s
 * `onClose`, wired in the component so the panel starts leaving before the
 * action runs, exactly as `Menu` documents.
 */
function toMenuEntries(
  items: MenuItemProps[],
  AnimatedIcon: HoldMenuIconComponent | null,
  onSelectItem: (item: MenuItemProps) => void,
): MenuEntry[] {
  const entries: MenuEntry[] = [];
  for (const item of items) {
    if (item.isTitle) entries.push({ type: 'label', label: item.text });
    else
      entries.push({
        id: item.text,
        label: item.text,
        destructive: item.isDestructive,
        disabled: item.disabled,
        icon: toMenuIcon(item.icon, AnimatedIcon),
        onSelect: () => onSelectItem(item),
      });
    if (item.withSeparator) entries.push({ type: 'separator' });
  }
  return entries;
}

/**
 * The panel — upstream's `MenuList`: the near-opaque surface that pops out of
 * the corner nearest the held item.
 *
 * The panel's width is the widest row's content width — floored to the minimum
 * and capped to 40% of the window (upstream used a fixed 60%) — resolved during
 * activation into `menuProps.menuWidth`, so a short menu hugs its rows instead
 * of spanning a fixed fraction of the screen. Its height is the effective
 * `menuHeight` the activating `HoldItem` stored — already capped to the room left
 * after travel — so a menu taller than the viewport scrolls instead of running
 * off the screen, and its absolute left is clamped into the safe viewport.
 *
 * The rows are the generic `Menu`'s `'segmented'` variant — the hold-menu style
 * `Menu` owns as the source of truth — over a near-opaque themed panel fill.
 * Item rows cross into React state through the same `useAnimatedReaction` +
 * `deepEqual` sync upstream uses.
 */
const MenuListComponent = () => {
  const { state, theme, menuProps, windowSize, safeAreaInsets, AnimatedIcon } = useHoldMenuInternal();

  const [itemList, setItemList] = useState<MenuItemProps[]>([]);
  const prevList = useSharedValue<MenuItemProps[]>([]);

  const messageStyles = useAnimatedStyle(() => {
    const menuWidth = menuProps.value.menuWidth;

    const translate = menuAnimationAnchor(
      menuProps.value.anchorPosition,
      menuProps.value.itemWidth,
      menuProps.value.menuHeight,
      menuWidth,
    );

    const left = resolveMenuPanelLeft({
      itemX: menuProps.value.itemX,
      itemWidth: menuProps.value.itemWidth,
      menuWidth,
      windowWidth: windowSize.value.width,
      safeLeft: safeAreaInsets.value.left,
      safeRight: safeAreaInsets.value.right,
      anchorPosition: menuProps.value.anchorPosition,
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

  const panelStyle = useAnimatedStyle(
    () => ({
      backgroundColor: theme.value === 'light' ? MENU_PANEL_LIGHT_COLOR : MENU_PANEL_DARK_COLOR,
    }),
    [theme],
  );

  const closeMenu = useCallback(() => {
    state.value = CONTEXT_MENU_STATE.END;
  }, [state]);

  const handleSelect = useCallback(
    (item: MenuItemProps) => {
      const params = menuProps.value.actionParams[item.text] || [];
      if (item.onPress) item.onPress(...params);
    },
    [menuProps],
  );

  const entries = useMemo(() => toMenuEntries(itemList, AnimatedIcon, handleSelect), [itemList, AnimatedIcon, handleSelect]);

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
      testID="hold-menu-panel"
      className="absolute top-0 z-[15] flex-row items-start justify-start overflow-hidden rounded-menu"
      style={messageStyles}
    >
      <Animated.View className="absolute inset-0 flex-col items-center justify-start" style={panelStyle}>
        <ScrollView bounces={false} showsVerticalScrollIndicator={false} className="absolute inset-0">
          <Menu entries={entries} onClose={closeMenu} iconGutter="off" variant="segmented" />
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
};

export const MenuList = memo(MenuListComponent);
