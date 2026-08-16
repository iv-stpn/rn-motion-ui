import { memo, type ReactNode, useMemo } from 'react';
import type { ViewProps } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Portal } from '../../portal/Portal/portal';
import { CONTEXT_MENU_STATE, HOLD_ITEM_TRANSFORM_DURATION, SPRING_CONFIGURATION } from './constants';
import { useHoldMenuInternal } from './context';
import type { HoldItemProps, MenuItemProps, TransformOriginAnchorPosition } from './hold-menu-types';
import { calculateMenuHeight, calculateTransformValue } from './layout';

type HoldItemTwinProps = {
  /** Stable portal name/key — the twin never remounts. */
  name: string;
  children: ReactNode;
  items: MenuItemProps[];
  disableMove: HoldItemProps['disableMove'];
  closeOnTap: boolean | undefined;
  isActive: SharedValue<boolean>;
  itemRectY: SharedValue<number>;
  itemRectX: SharedValue<number>;
  itemRectWidth: SharedValue<number>;
  itemRectHeight: SharedValue<number>;
  itemScale: SharedValue<number>;
  transformOrigin: SharedValue<TransformOriginAnchorPosition>;
};

/**
 * The portal twin of a `HoldItem`'s children — the lifted copy that takes
 * over while the menu is open. Upstream's `Portal` + `animatedPortalStyle` +
 * `PortalOverlay` block from `HoldItem.tsx`, split out so the component stays
 * under the per-function line limit.
 *
 * It is PERMANENTLY MOUNTED (stable `name`/key), positioned at the measured
 * rect, and toggled by animated opacity plus `pointerEvents` — nothing ever
 * remounts. While the menu is active it is the visible item, scaled back to 1
 * and travelling with the panel (springing to the same `tY` the activating
 * item published); the in-place original hides under it. A tap-to-close overlay
 * (upstream's `PortalOverlay`) sits above the children and closes the menu when
 * `closeOnTap`. The portal host is a plain view, so the always-mounted twin
 * never blocks page touches.
 */
const HoldItemTwinComponent = ({
  name,
  children,
  items,
  disableMove = false,
  closeOnTap,
  isActive,
  itemRectY,
  itemRectX,
  itemRectWidth,
  itemRectHeight,
  itemScale,
  transformOrigin,
}: HoldItemTwinProps) => {
  const { state, safeAreaInsets, windowSize } = useHoldMenuInternal();

  const overlayTap = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        if (closeOnTap) state.value = CONTEXT_MENU_STATE.END;
      }),
    [closeOnTap, state],
  );

  const animatedPortalStyle = useAnimatedStyle(() => {
    const animateOpacity = () => withDelay(HOLD_ITEM_TRANSFORM_DURATION, withTiming(0, { duration: 0 }));

    const itemsWithSeparator = items.filter((item) => item.withSeparator);
    const menuHeight = calculateMenuHeight(items.length, itemsWithSeparator.length, windowSize.value.fontScale);
    const windowHeight = windowSize.value.height;

    // The same travel the activating item computed and published — upstream
    // recomputes it here rather than reading the stored `transformValue`.
    const tY = calculateTransformValue({
      itemY: itemRectY.value,
      itemHeight: itemRectHeight.value,
      menuHeight,
      disableMove: disableMove === true,
      opensBelow: transformOrigin.value.includes('top'),
      windowHeight,
      safeTop: safeAreaInsets.value.top,
      safeBottom: safeAreaInsets.value.bottom,
    });

    // The pair travels while active (spring there) and settles back off-screen
    // on close — upstream's `transformAnimation`.
    const transformAnimation = () => {
      if (disableMove) return 0;
      if (isActive.value) return withSpring(tY, SPRING_CONFIGURATION);
      return withTiming(-0.1, { duration: HOLD_ITEM_TRANSFORM_DURATION });
    };

    return {
      top: itemRectY.value,
      left: itemRectX.value,
      width: itemRectWidth.value,
      height: itemRectHeight.value,
      opacity: isActive.value ? 1 : animateOpacity(),
      transform: [
        { translateY: transformAnimation() },
        {
          scale: isActive.value ? withTiming(1, { duration: HOLD_ITEM_TRANSFORM_DURATION }) : itemScale.value,
        },
      ],
    };
  }, [
    items,
    disableMove,
    isActive,
    itemRectY,
    itemRectX,
    itemRectWidth,
    itemRectHeight,
    itemScale,
    transformOrigin,
    safeAreaInsets,
    windowSize,
  ]);

  const animatedPortalProps = useAnimatedProps<ViewProps>(() => ({
    pointerEvents: isActive.value ? 'auto' : 'none',
  }));

  return (
    <Portal name={name}>
      <Animated.View key={name} className="absolute z-10" style={animatedPortalStyle} animatedProps={animatedPortalProps}>
        <GestureDetector gesture={overlayTap}>
          <Animated.View className="absolute inset-0 z-[15]" />
        </GestureDetector>
        {children}
      </Animated.View>
    </Portal>
  );
};

export const HoldItemTwin = memo(HoldItemTwinComponent);
