import { memo, useEffect, useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedReaction, useAnimatedRef, useSharedValue } from 'react-native-reanimated';
import { PortalProvider } from '../../portal/Portal/portal';
import { useBlurTargetRef } from '../Overlay/blur-context';
import { OverlayPortal } from '../Overlay/overlay-host';
import { Backdrop } from './backdrop';
import { CONTEXT_MENU_STATE } from './constants';
import { HoldMenuInternalContext, type HoldMenuInternalContextType, setHoldMenuInternalContext } from './context';
import type { HoldMenuProviderProps, HoldMenuSafeAreaInsets, MenuInternalProps } from './hold-menu-types';
import { Menu } from './menu';

/**
 * `HoldMenuProvider` — upstream's provider: a `GestureHandlerRootView` (flex
 * 1), the internal context carrying the menu's shared values, then the children
 * and the always-mounted `Backdrop` and `Menu`. One menu at a time, driven
 * entirely by the `state` shared value.
 *
 * The overlay's home is platform-split (see the render body): on **Android** the
 * backdrop/menu/twins render OUTSIDE the `BlurTarget` through the `BlurProvider`
 * overlay host so the target-based blur frosts only the page and the menu paints
 * crisp above it (a scrim left inside the target crashes or frosts the menu); on
 * **iOS/web** the blur is a true backdrop, so the overlay stays inline inside the
 * root under a `PortalProvider` (which lifts the twins above the backdrop/menu).
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
  const blurTargetRef = useBlurTargetRef();

  // Whether the overlay teleports out of the `BlurTarget` into the provider's
  // overlay host (Android with the peer installed). When true the menu/twins
  // must offset their root-space coords back by the root's page position.
  const teleported = Platform.OS === 'android' && blurTargetRef !== null;

  // The root's page offset, measured during activation and mirrored here so the
  // teleported overlay (which renders outside this provider's React tree, in the
  // `BlurProvider` overlay host) can translate root-space coords into the host's
  // window-space. Zero until the first activation measures it.
  const rootPageX = useSharedValue(0);
  const rootPageY = useSharedValue(0);

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
      rootPageX,
      rootPageY,
      teleported,
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
      rootPageX,
      rootPageY,
      teleported,
      overlay,
      closeOnOutsidePress,
    ],
  );

  // Publish the shared values into the module-store mirror (see `context.ts`) so
  // the overlay content — rendered OUTSIDE this provider's React tree through the
  // `BlurProvider` overlay host — can still read them (the effect runs post-render).
  // biome-ignore lint/plugin: prop → shared value sync must run after render, not during it
  useEffect(() => {
    setHoldMenuInternalContext(internalContextVariables);
    return () => setHoldMenuInternalContext(null);
  }, [internalContextVariables]);

  // The always-mounted overlay (backdrop + menu). Kept stable so the
  // `OverlayPortal` (Android) registers it once rather than on every render.
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
          {teleported ? (
            <>
              {children}
              {/* Android: the overlay renders OUTSIDE the `BlurTarget` through the
                  `BlurProvider` overlay host (a sibling of the target). The
                  target-based blur then captures only the page — not the menu —
                  and the menu paints after the blur, crisp on top; a scrim left
                  inside the target would either crash (the peer's RenderNode
                  cycle) or frost the menu. The twins join it at a higher layer
                  from each `HoldItem` (see `hold-item-twin`). */}
              <OverlayPortal layer="menu">{overlayContent}</OverlayPortal>
            </>
          ) : (
            /* iOS/web, and Android without a `BlurProvider` (no overlay host to
               receive the portal): the blur is a true backdrop, so the overlay stays
               inline in the root and the `PortalProvider` lifts the twins above it. */
            <PortalProvider>
              {children}
              {overlayContent}
            </PortalProvider>
          )}
        </Animated.View>
      </HoldMenuInternalContext.Provider>
    </GestureHandlerRootView>
  );
};

export const HoldMenuProvider = memo(ProviderComponent);
