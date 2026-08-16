import { useCallback } from 'react';
import Animated, { type AnimatedRef, measure, type SharedValue, useSharedValue } from 'react-native-reanimated';
import type { CONTEXT_MENU_STATE } from './hold-menu-constants';
import type { HoldMenuSafeAreaInsets, HoldMenuWindowSize } from './hold-menu-context';
import {
  calculateMenuHeight,
  getTransformOrigin,
  menuPanelHeight,
  resolveHoldMenuTravel,
  type TransformOriginAnchorPosition,
} from './hold-menu-layout';
import type { HoldItemProps, MenuInternalProps, MenuItemProps } from './hold-menu-types';

type UseHoldItemActivationOptions = {
  containerRef: AnimatedRef<Animated.View>;
  items: MenuItemProps[];
  actionParams: HoldItemProps['actionParams'];
  disableMove: HoldItemProps['disableMove'];
  bottom: boolean | undefined;
  menuAnchorPosition: TransformOriginAnchorPosition | undefined;
  testID: string | undefined;
  menuProps: SharedValue<MenuInternalProps>;
  windowSize: SharedValue<HoldMenuWindowSize>;
  safeAreaInsets: SharedValue<HoldMenuSafeAreaInsets>;
  state: SharedValue<CONTEXT_MENU_STATE>;
  scaleHold: (duration?: number) => void;
};

type UseHoldItemActivationResult = {
  itemRectY: SharedValue<number>;
  itemRectX: SharedValue<number>;
  itemRectWidth: SharedValue<number>;
  itemRectHeight: SharedValue<number>;
  transformOrigin: SharedValue<TransformOriginAnchorPosition>;
  transformValue: SharedValue<number>;
  didMeasureLayout: SharedValue<boolean>;
  activateAnimation: () => void;
  activateFromContextMenu: () => void;
};

/**
 * The measurement + publishing half of a `HoldItem` — upstream's
 * `activateAnimation` / `setMenuProps` worklets, extracted from the component
 * so it stays under the per-function line limit.
 *
 * The wrapper is measured once per activation on the UI thread
 * (`measure()` inside a worklet — no `measureInWindow` round-trip, no
 * layout-state race), the anchor is computed (or taken from
 * `menuAnchorPosition`), and the travel + panel-height cap are resolved with
 * the rotation-safe window size and safe-area insets before everything is
 * published into `menuProps`.
 */
export function useHoldItemActivation({
  containerRef,
  items,
  actionParams,
  disableMove,
  bottom,
  menuAnchorPosition,
  testID,
  menuProps,
  windowSize,
  safeAreaInsets,
  scaleHold,
}: UseHoldItemActivationOptions): UseHoldItemActivationResult {
  const itemRectY = useSharedValue<number>(0);
  const itemRectX = useSharedValue<number>(0);
  const itemRectWidth = useSharedValue<number>(0);
  const itemRectHeight = useSharedValue<number>(0);
  const transformValue = useSharedValue<number>(0);
  const didMeasureLayout = useSharedValue(false);

  const transformOrigin = useSharedValue<TransformOriginAnchorPosition>(menuAnchorPosition || 'top-right');

  /**
   * Estimated panel height for this item's rows — upstream's `useMemo`
   * `calculateMenuHeight`, computed with the rotation-safe font scale.
   */
  const getMenuHeight = useCallback(() => {
    'worklet';
    const itemsWithSeparator = items.filter((item) => item.withSeparator);
    return calculateMenuHeight(items.length, itemsWithSeparator.length, windowSize.value.fontScale);
  }, [items, windowSize]);

  const setMenuProps = useCallback(
    (effectiveMenuHeight: number) => {
      'worklet';

      menuProps.value = {
        itemHeight: itemRectHeight.value,
        itemWidth: itemRectWidth.value,
        itemY: itemRectY.value,
        itemX: itemRectX.value,
        anchorPosition: transformOrigin.value,
        menuHeight: effectiveMenuHeight,
        items,
        transformValue: transformValue.value,
        actionParams: actionParams || {},
        testID,
      };
    },
    [
      menuProps,
      itemRectHeight,
      itemRectWidth,
      itemRectY,
      itemRectX,
      transformOrigin,
      transformValue,
      items,
      actionParams,
      testID,
    ],
  );

  const activateAnimation = useCallback(() => {
    'worklet';
    if (!didMeasureLayout.value) {
      const measured = measure(containerRef);
      if (!measured) return;

      itemRectY.value = measured.pageY;
      itemRectX.value = measured.pageX;
      itemRectHeight.value = measured.height;
      itemRectWidth.value = measured.width;

      if (!menuAnchorPosition) {
        const position = getTransformOrigin(measured.pageX, itemRectWidth.value, windowSize.value.width, bottom);
        transformOrigin.value = position;
      }

      const height = getMenuHeight();
      const travel = resolveHoldMenuTravel({
        itemY: itemRectY.value,
        itemHeight: itemRectHeight.value,
        menuHeight: height,
        disableMove: disableMove === true,
        opensBelow: transformOrigin.value.includes('top'),
        windowHeight: windowSize.value.height,
        safeTop: safeAreaInsets.value.top,
        safeBottom: safeAreaInsets.value.bottom,
      });
      transformValue.value = travel.tY;
      setMenuProps(menuPanelHeight(height, travel.maxHeight));
      didMeasureLayout.value = true;
    }
  }, [
    didMeasureLayout,
    containerRef,
    itemRectY,
    itemRectX,
    itemRectHeight,
    itemRectWidth,
    menuAnchorPosition,
    transformOrigin,
    transformValue,
    windowSize,
    bottom,
    getMenuHeight,
    disableMove,
    safeAreaInsets,
    setMenuProps,
  ]);

  /** Web: measure and open, running the lift choreography instead of an instant pop. */
  const activateFromContextMenu = useCallback(() => {
    'worklet';
    if (!items || items.length === 0) return;
    activateAnimation();
    // Web: an instant trigger (right-click, click) still runs the library's
    // lift choreography — a quick squeeze, then onCompletion flips the menu
    // active and the item scales back up while the panel pops out of it.
    scaleHold(120);
  }, [items, activateAnimation, scaleHold]);

  return {
    itemRectY,
    itemRectX,
    itemRectWidth,
    itemRectHeight,
    transformOrigin,
    transformValue,
    didMeasureLayout,
    activateAnimation,
    activateFromContextMenu,
  };
}
