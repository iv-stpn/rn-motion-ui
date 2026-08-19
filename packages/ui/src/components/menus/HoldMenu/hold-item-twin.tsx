import { memo, type ReactNode, useMemo } from 'react';
import { View, type ViewProps } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { type SharedValue, useAnimatedProps, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
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
  /** Release handover, 0 = active (this twin shows), 1 = released (it is hidden). */
  releaseProgress: SharedValue<number>;
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
  releaseProgress,
  itemRectY,
  itemRectX,
  itemRectWidth,
  itemRectHeight,
  itemScale,
  transformOrigin,
}: HoldItemTwinProps) => {
  const { state, safeAreaInsets, windowSize, rootHeight } = useHoldMenuInternal();

  const overlayTap = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        if (closeOnTap) state.value = CONTEXT_MENU_STATE.END;
      }),
    [closeOnTap, state],
  );

  const animatedPortalStyle = useAnimatedStyle(() => {
    const itemsWithSeparator = items.filter((item) => item.withSeparator);
    const menuHeight = calculateMenuHeight(items.length, itemsWithSeparator.length, windowSize.value.fontScale);
    // Clamp against the root's real bottom, not the window's — the two differ
    // whenever the provider root is inset from the window (storybook's padding,
    // a menu nested inside a scroll view).
    const windowHeight = rootHeight.value || windowSize.value.height;

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
      // `releaseProgress` drives both this opacity and the in-place item's from
      // one shared value, so the two flip on the same frame — no overlap window
      // (a cross-fade would dim, since stacked semi-transparent layers don't sum
      // to full opacity) and no one-frame hole (two independent delay+timing
      // animations could drift a frame apart on web). 0 = active (this twin
      // shows), 1 = released (the in-place item is back).
      opacity: 1 - releaseProgress.value,
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
    releaseProgress,
    itemRectY,
    itemRectX,
    itemRectWidth,
    itemRectHeight,
    itemScale,
    transformOrigin,
    safeAreaInsets,
    windowSize,
    rootHeight,
  ]);

  const animatedPortalProps = useAnimatedProps<ViewProps>(() => ({
    pointerEvents: isActive.value ? 'auto' : 'none',
  }));

  return (
    <Portal name={name}>
      <Animated.View key={name} className="absolute z-10" style={animatedPortalStyle} animatedProps={animatedPortalProps}>
        {/* A decorative duplicate of the in-place item: never announce it (a screen
            reader would read every entry twice), and keep it out of role/text queries
            while the real item stays the accessible one. `aria-hidden` is the web
            spelling RNW reads; the two RN props cover native. They sit on a plain
            `View`, not the `Animated.View` above, because reanimated drops `aria-*`
            props on the way to the DOM — the twin would otherwise match role queries
            alongside the real entry. */}
        <View aria-hidden={true} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">
          <GestureDetector gesture={overlayTap}>
            <Animated.View className="absolute inset-0 z-[15]" />
          </GestureDetector>
          {children}
        </View>
      </Animated.View>
    </Portal>
  );
};

export const HoldItemTwin = memo(HoldItemTwinComponent);
