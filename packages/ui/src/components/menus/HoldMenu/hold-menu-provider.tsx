import { memo, useEffect, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedReaction, useSharedValue } from 'react-native-reanimated';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { useSafeInsets } from '../../../hooks/use-safe-insets';
import { PortalProvider } from '../../portal/Portal/portal';
import { Backdrop } from './backdrop';
import { CONTEXT_MENU_STATE } from './hold-menu-constants';
import { HoldMenuInternalContext, type HoldMenuInternalContextType } from './hold-menu-context';
import type { HoldMenuProviderProps, MenuInternalProps } from './hold-menu-types';
import { Menu } from './menu';

/**
 * `HoldMenuProvider` — upstream's provider: a `GestureHandlerRootView` (flex
 * 1), the `InternalContext` carrying the menu's shared values, a
 * `PortalProvider` (the package's portal primitive), then the children, then
 * the always mounted `Backdrop` and `Menu` inside the portal host. One menu at
 * a time, driven entirely by the `state` shared value.
 *
 * Rotation safety is the departure from upstream: window dimensions come from
 * `useWindowDimensions` and are mirrored into a shared value, so the menu and
 * backdrop re-place themselves after a rotation instead of reading stale
 * module-level `Dimensions`.
 *
 * `safeAreaInsets` is optional here (upstream requires it): when omitted, the
 * provider uses `use-safe-insets.ts`, which resolves
 * `react-native-safe-area-context` when it is installed and falls back to
 * zeros. The animated `iconComponent` lives in the context value — upstream
 * keeps a module-level `let`, which this port deliberately does not.
 */
const ProviderComponent = ({
  children,
  theme: selectedTheme,
  iconComponent,
  safeAreaInsets: safeAreaInsetsProp,
  onOpen,
  onClose,
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
    transformValue: 0,
    actionParams: {},
  });

  const resolvedInsets = useSafeInsets();
  const resolvedInsetsValue = useMemo(() => ({ ...resolvedInsets }), [resolvedInsets]);
  const safeAreaInsets = useSharedValue(resolvedInsetsValue);

  const reduced = useReducedMotion();
  const reducedMotion = useSharedValue<0 | 1>(reduced ? 1 : 0);

  const { width, height, fontScale } = useWindowDimensions();
  const windowSize = useSharedValue({ width, height, fontScale });

  // The four effects below sync React state / props into shared values. That
  // must happen after a render commit, not during it, so each carries a
  // suppression comment for the no-use-effect plugin; the shared values are
  // stable references, so only the source values belong in the dependency
  // lists.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the shared value is a stable reference — only the prop retriggers
  // biome-ignore lint/plugin: prop → shared value sync must run after render, not during it
  useEffect(() => {
    theme.value = selectedTheme || 'light';
  }, [selectedTheme]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the shared value is a stable reference — only the sources retrigger
  // biome-ignore lint/plugin: prop → shared value sync must run after render, not during it
  useEffect(() => {
    // The prop wins when given; otherwise the hook's resolution (safe-area
    // context when installed, zeros otherwise).
    safeAreaInsets.value = safeAreaInsetsProp ?? resolvedInsetsValue;
  }, [safeAreaInsetsProp, resolvedInsetsValue]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the shared value is a stable reference — only the source retriggers
  // biome-ignore lint/plugin: state → shared value sync must run after render, not during it
  useEffect(() => {
    reducedMotion.value = reduced ? 1 : 0;
  }, [reduced]);

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

  const internalContextVariables = useMemo<HoldMenuInternalContextType>(
    () => ({
      state,
      theme,
      menuProps,
      safeAreaInsets,
      windowSize,
      reducedMotion,
      AnimatedIcon,
    }),
    [state, theme, menuProps, safeAreaInsets, windowSize, reducedMotion, AnimatedIcon],
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HoldMenuInternalContext.Provider value={internalContextVariables}>
        <PortalProvider>
          {children}
          <Backdrop />
          <Menu />
        </PortalProvider>
      </HoldMenuInternalContext.Provider>
    </GestureHandlerRootView>
  );
};

const Provider = memo(ProviderComponent);

export { Provider as HoldMenuProvider };
