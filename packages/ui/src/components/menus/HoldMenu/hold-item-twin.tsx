import { Portal } from '@gorhom/portal';
import { memo, type ReactNode, useMemo } from 'react';
import type { ViewProps } from 'react-native';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { CONTEXT_MENU_STATE, HOLD_ITEM_TRANSFORM_DURATION, SPRING_CONFIGURATION } from './hold-menu-constants';
import { useHoldMenuInternal } from './hold-menu-context';
import { calculateMenuHeight, calculateTransformValue, type TransformOriginAnchorPosition } from './hold-menu-layout';
import type { HoldItemProps, MenuItemProps } from './hold-menu-types';

const styles = StyleSheet.create({
  holdItem: { zIndex: 10, position: 'absolute' },
  portalOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 15,
  },
});

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
 * The portal twin of a `HoldItem`'s children — the lifted copy that takes over
 * while the menu is open.
 *
 * It is PERMANENTLY MOUNTED (stable `name`/key), positioned at the measured
 * rect, and toggled by animated opacity plus `pointerEvents` — nothing ever
 * remounts, which is the structural reason there is no remount flicker. While
 * the menu is active it is the visible item, scaled back to 1 and travelling
 * with the panel; the in-place original hides under it. A tap-to-close overlay
 * (upstream's `PortalOverlay`) sits above the children and closes the menu
 * when `closeOnTap`. Because the portal host is a plain view rather than a
 * native `Modal`, the always-mounted twin never blocks page touches.
 *
 * Rendered only when `HOLD_MENU_LIFTS` (native) — web renders the children
 * once, so the DOM is never duplicated.
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
  const { state, windowSize, safeAreaInsets, reducedMotion } = useHoldMenuInternal();

  const overlayTap = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        if (closeOnTap) state.value = CONTEXT_MENU_STATE.END;
      }),
    [closeOnTap, state],
  );

  /** Same estimate the activating item used, so the twin travels with the panel. */
  const menuHeightEstimate = () => {
    'worklet';
    const itemsWithSeparator = items.filter((item) => item.withSeparator);
    return calculateMenuHeight(items.length, itemsWithSeparator.length, windowSize.value.fontScale);
  };

  const animatedPortalStyle = useAnimatedStyle(() => {
    const animateOpacity = () =>
      withDelay(reducedMotion.value === 1 ? 0 : HOLD_ITEM_TRANSFORM_DURATION, withTiming(0, { duration: 0 }));

    const tY = calculateTransformValue({
      itemY: itemRectY.value,
      itemHeight: itemRectHeight.value,
      menuHeight: menuHeightEstimate(),
      disableMove,
      opensBelow: transformOrigin.value.includes('top'),
      windowHeight: windowSize.value.height,
      safeTop: safeAreaInsets.value.top,
      safeBottom: safeAreaInsets.value.bottom,
    });

    // The pair travels while active — spring there (or snap, reduced motion) —
    // and settles back off-screen on close.
    const transformAnimation = () => {
      if (disableMove) return 0;
      if (isActive.value) {
        if (reducedMotion.value === 1) return withTiming(tY, { duration: 0 });
        return withSpring(tY, SPRING_CONFIGURATION);
      }
      return withTiming(-0.1, { duration: HOLD_ITEM_TRANSFORM_DURATION });
    };

    return {
      zIndex: 10,
      position: 'absolute',
      top: itemRectY.value,
      left: itemRectX.value,
      width: itemRectWidth.value,
      height: itemRectHeight.value,
      opacity: isActive.value ? 1 : animateOpacity(),
      transform: [
        { translateY: transformAnimation() },
        {
          scale: isActive.value
            ? withTiming(1, {
                duration: reducedMotion.value === 1 ? 0 : HOLD_ITEM_TRANSFORM_DURATION,
                easing: reducedMotion.value === 1 ? undefined : Easing.out(Easing.cubic),
              })
            : itemScale.value,
        },
      ],
    };
  }, [
    reducedMotion,
    disableMove,
    isActive,
    itemRectY,
    itemRectX,
    itemRectWidth,
    itemRectHeight,
    itemScale,
    transformOrigin,
    windowSize,
    safeAreaInsets,
    items,
  ]);

  const portalContainerStyle = useMemo(() => [styles.holdItem, animatedPortalStyle], [animatedPortalStyle]);

  const animatedPortalProps = useAnimatedProps<ViewProps>(() => ({
    pointerEvents: isActive.value ? 'auto' : 'none',
  }));

  return (
    <Portal name={name}>
      <Animated.View key={name} style={portalContainerStyle} animatedProps={animatedPortalProps}>
        <GestureDetector gesture={overlayTap}>
          <Animated.View style={styles.portalOverlay} />
        </GestureDetector>
        {children}
      </Animated.View>
    </Portal>
  );
};

export const HoldItemTwin = memo(HoldItemTwinComponent);
