import { memo, useEffect, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedReaction, useAnimatedRef, useSharedValue } from 'react-native-reanimated';
import { PortalProvider } from '../../portal/Portal/portal';
import { Backdrop } from './backdrop';
import { CONTEXT_MENU_STATE } from './constants';
import { HoldMenuInternalContext, type HoldMenuInternalContextType } from './context';
import type { HoldMenuProviderProps, HoldMenuSafeAreaInsets, MenuInternalProps } from './hold-menu-types';
import { Menu } from './menu';

/**
 * `HoldMenuProvider` — upstream's provider: a `GestureHandlerRootView` (flex
 * 1), the internal context carrying the menu's shared values, then the children
 * and the always-mounted `Backdrop` and `Menu`. One menu at a time, driven
 * entirely by the `state` shared value.
 *
 * The overlay (backdrop + menu) renders inline inside the root, under a
 * `PortalProvider` — which lifts the always-mounted twins above the backdrop and
 * menu. The blur is a true backdrop (`react-native-liquid-glassmorphism`
 * captures the page as a bitmap), so the overlay stays inside the root on every
 * platform.
 *
 * Rotation safety is the departure from upstream: window dimensions come from
 * `useWindowDimensions` and are mirrored into a shared value, so the menu and
 * backdrop re-place themselves after a rotation instead of reading stale
 * module-level `Dimensions`. The provider's root view is exposed through
 * `rootRef` so activation can subtract its page offset and anchor the menu
 * correctly even when the root is offset from the viewport origin.
 *
 * `safeAreaInsets` is a shared value in the context, exactly as the sibling
 * `HoldMenu` keeps it: the insets are read inside UI-thread worklets and must
 * not be a frozen plain-object snapshot; the animated `iconComponent` lives in
 * the context value rather than upstream's module-level `let`.
 */
const ProviderComponent = ({
  children,
  theme: selectedTheme,
  iconComponent,
  safeAreaInsets,
  onOpen,
  onClose,
  overlay = 'blur',
  closeOnOutsidePress = true,
}: HoldMenuProviderProps) => {
  const state = useSharedValue<CONTEXT_MENU_STATE>(CONTEXT_MENU_STATE.UNDETERMINED);
  const theme = useSharedValue<'light' | 'dark'>(selectedTheme || 'light');
  const menuProps = useSharedValue<MenuInternalProps>({
    itemHeight: 0,
    itemWidth: 0,
    itemY: 0,
    itemX: 0,
    items: [],
    anchorPosition: 'top-center',
    menuHeight: 0,
    menuWidth: 0,
    transformValue: 0,
    actionParams: {},
  });

  const { width, height, fontScale } = useWindowDimensions();
  const windowSize = useSharedValue({ width, height, fontScale });

  // The provider root's VISIBLE extent — filled in by each activation's
  // `measure(rootRef)` (the root's measured height capped to the window's
  // bottom edge relative to the root's top) and read by the travel math (and
  // the always-mounted twin) so the panel clamps against the root's real
  // bottom, not the window's — and not the root's full scrollable height when
  // the provider sits inside a scroll view. A shared value so both the activating
  // item and its twin read the same number, so the clamp re-syncs on rotation.
  const rootViewportHeight = useSharedValue(0);

  // Insets live in a shared value so UI-thread worklets read a live value, not a
  // frozen plain-object capture (the sibling `HoldMenu` does the same).
  const safeAreaInsetsValue = useSharedValue<HoldMenuSafeAreaInsets>(safeAreaInsets || { top: 0, right: 0, bottom: 0, left: 0 });

  // biome-ignore lint/correctness/useExhaustiveDependencies: the shared value is a stable reference — only the prop retriggers
  // biome-ignore lint/plugin: prop → shared value sync must run after render, not during it
  useEffect(() => {
    theme.value = selectedTheme || 'light';
  }, [selectedTheme]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the shared value is a stable reference — only the prop retriggers
  // biome-ignore lint/plugin: prop → shared value sync must run after render, not during it
  useEffect(() => {
    safeAreaInsetsValue.value = safeAreaInsets || { top: 0, right: 0, bottom: 0, left: 0 };
  }, [safeAreaInsets]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the shared value is a stable reference — only the source retriggers
  // biome-ignore lint/plugin: window dimensions → shared value sync must run after render, not during it
  useEffect(() => {
    windowSize.value = { width, height, fontScale };
  }, [width, height, fontScale]);

  useAnimatedReaction(
    () => state.value,
    (current) => {
      switch (current) {
        case CONTEXT_MENU_STATE.ACTIVE: {
          if (onOpen) runOnJS(onOpen)();
          break;
        }
        case CONTEXT_MENU_STATE.END: {
          if (onClose) runOnJS(onClose)();
          break;
        }
        default:
          break;
      }
    },
    [state],
  );

  const AnimatedIcon = useMemo(() => (iconComponent ? Animated.createAnimatedComponent(iconComponent) : null), [iconComponent]);

  // The containing block the `Menu`'s absolute positioning is relative to. The
  // activation worklet measures it and subtracts its page offset from the held
  // item's page coords, so the menu anchors correctly even when the root is
  // offset from the viewport origin (storybook's padding decorator on web).
  const rootRef = useAnimatedRef<Animated.View>();

  const internalContextVariables = useMemo<HoldMenuInternalContextType>(
    () => ({
      state,
      theme,
      menuProps,
      safeAreaInsets: safeAreaInsetsValue,
      windowSize,
      rootViewportHeight,
      AnimatedIcon,
      rootRef,
      overlay,
      closeOnOutsidePress,
    }),
    [
      state,
      theme,
      menuProps,
      safeAreaInsetsValue,
      windowSize,
      rootViewportHeight,
      AnimatedIcon,
      rootRef,
      overlay,
      closeOnOutsidePress,
    ],
  );

  // The always-mounted overlay (backdrop + menu), kept stable so the portal
  // host registers it once rather than on every render.
  const overlayContent = useMemo(
    () => (
      <>
        <Backdrop />
        <Menu />
      </>
    ),
    [],
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HoldMenuInternalContext.Provider value={internalContextVariables}>
        <Animated.View ref={rootRef} className="flex-1">
          {/* The blur is a true backdrop, so the overlay stays inline in the root
              and the `PortalProvider` lifts the twins above it. */}
          <PortalProvider>
            {children}
            {overlayContent}
          </PortalProvider>
        </Animated.View>
      </HoldMenuInternalContext.Provider>
    </GestureHandlerRootView>
  );
};

export const HoldMenuProvider = memo(ProviderComponent);
