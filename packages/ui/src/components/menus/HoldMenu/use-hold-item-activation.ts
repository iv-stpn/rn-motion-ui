import { useCallback } from 'react';
import Animated, { type AnimatedRef, measure, type SharedValue, useSharedValue } from 'react-native-reanimated';
import { MENU_WIDTH_RATIO } from './constants';
import type { HoldMenuWindowSize } from './context';
import type {
  HoldItemProps,
  HoldMenuSafeAreaInsets,
  MenuInternalProps,
  MenuItemProps,
  TransformOriginAnchorPosition,
} from './hold-menu-types';
import {
  calculateMenuHeight,
  getTransformOrigin,
  menuPanelHeight,
  resolveHoldMenuTravel,
  resolveMenuAnchorPosition,
  resolveRootViewportHeight,
} from './layout';

type UseHoldItemActivationOptions = {
  containerRef: AnimatedRef<Animated.View>;
  /** The provider's root view — the containing block the menu anchors against. */
  rootRef: AnimatedRef<Animated.View>;
  items: MenuItemProps[];
  actionParams: HoldItemProps['actionParams'];
  disableMove: HoldItemProps['disableMove'];
  bottom: boolean | undefined;
  menuAnchorPosition: TransformOriginAnchorPosition | undefined;
  menuProps: SharedValue<MenuInternalProps>;
  windowSize: SharedValue<HoldMenuWindowSize>;
  /** The provider root's visible extent — the travel clamp's viewport, updated each activation. */
  rootViewportHeight: SharedValue<number>;
  safeAreaInsets: SharedValue<HoldMenuSafeAreaInsets>;
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
 * `activateAnimation` / `calculateTransformValue` / `setMenuProps` worklets
 * from `HoldItem.tsx`, extracted so the component stays under the per-function
 * line limit.
 *
 * The wrapper is measured once per activation on the UI thread (`measure()`
 * inside a worklet), the anchor is computed (or taken from
 * `menuAnchorPosition`), and the travel + panel-height cap are resolved with
 * the rotation-safe window size and safe-area insets before everything is
 * published into `menuProps`.
 *
 * Two departures from upstream, both carried over from the sibling `HoldMenu`
 * port: the item rect is left in the menu's own space (the root's page offset
 * is subtracted, so the menu anchors correctly even when the root is offset
 * from the viewport origin), and the travel is clamped (see
 * {@link resolveHoldMenuTravel}).
 */
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: the measurement + publish worklets (activateAnimation, activateFromContextMenu) share the item/root rect plumbing — splitting them would scatter the once-per-activation sequence
export function useHoldItemActivation({
  containerRef,
  rootRef,
  items,
  actionParams,
  disableMove,
  bottom,
  menuAnchorPosition,
  menuProps,
  windowSize,
  rootViewportHeight,
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

  /** Estimated panel height for this item's rows, at the rotation-safe font scale. */
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
      };
    },
    [menuProps, itemRectHeight, itemRectWidth, itemRectY, itemRectX, transformOrigin, transformValue, items, actionParams],
  );

  const activateAnimation = useCallback(() => {
    'worklet';
    if (!didMeasureLayout.value) {
      const measured = measure(containerRef);
      if (!measured) return;

      // `measure` returns viewport coords, but the menu is absolutely positioned
      // inside the provider's root view. Subtract the root's page offset so the
      // item rect is in the menu's own space. Native roots sit at (0,0): a no-op.
      const root = measure(rootRef);
      const rootX = root?.pageX ?? 0;
      const rootY = root?.pageY ?? 0;
      // The travel clamp's viewport: the root's measured height capped to the
      // window's bottom edge relative to the root's top — the part of the root
      // the user can actually see. When the provider sits inside a scrollable
      // container (native storybook, a scrolling app screen) the root's height
      // is the full content height; clamping against it would let the menu run
      // off the visible screen instead of lifting.
      rootViewportHeight.value = root
        ? resolveRootViewportHeight(root.height, root.pageY, windowSize.value.height)
        : windowSize.value.height;
      itemRectY.value = measured.pageY - rootY;
      itemRectX.value = measured.pageX - rootX;
      itemRectHeight.value = measured.height;
      // A fractional measured width rounded down leaves the portal twin a hair
      // narrower than the real item, so its text wraps to an extra line and grows
      // taller than the measured rect the menu anchors below. Round up so the twin
      // is never narrower than the item it copies.
      itemRectWidth.value = measured.width + 1;

      // The hinted (or auto-picked) anchor is overflow-checked against the panel
      // width, so a hint that would push the panel off-screen flips to the other side.
      const menuWidth = Math.round(windowSize.value.width * MENU_WIDTH_RATIO);
      const position =
        menuAnchorPosition ?? getTransformOrigin(measured.pageX, itemRectWidth.value, windowSize.value.width, bottom);
      transformOrigin.value = resolveMenuAnchorPosition({
        anchor: position,
        itemX: itemRectX.value,
        itemWidth: itemRectWidth.value,
        menuWidth,
        windowWidth: windowSize.value.width,
        safeLeft: safeAreaInsets.value.left,
        safeRight: safeAreaInsets.value.right,
      });

      const height = getMenuHeight();
      const travel = resolveHoldMenuTravel({
        itemY: itemRectY.value,
        itemHeight: itemRectHeight.value,
        menuHeight: height,
        disableMove: disableMove === true,
        opensBelow: transformOrigin.value.includes('top'),
        windowHeight: rootViewportHeight.value || windowSize.value.height,
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
    rootRef,
    itemRectY,
    itemRectX,
    itemRectHeight,
    itemRectWidth,
    menuAnchorPosition,
    transformOrigin,
    transformValue,
    windowSize,
    rootViewportHeight,
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
