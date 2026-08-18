import { createContext, useContext } from 'react';
import type Animated from 'react-native-reanimated';
import type { AnimatedRef, SharedValue } from 'react-native-reanimated';
import type { CONTEXT_MENU_STATE } from './constants';
import type { HoldMenuIconComponent, HoldMenuSafeAreaInsets, MenuInternalProps } from './hold-menu-types';

/** Rotation-safe window metrics, fed from `useWindowDimensions`. */
export type HoldMenuWindowSize = { width: number; height: number; fontScale: number };

/**
 * What `HoldMenuProvider` shares with every `HoldItem`, the `Menu` and the
 * `Backdrop` — the shared values upstream carries in its `InternalContext`.
 *
 * `safeAreaInsets` is a shared value here, exactly as the sibling `HoldMenu`
 * keeps it: the insets are read inside UI-thread worklets (`measure`-based
 * activation, the panel's viewport clamp, the twin's travel), and a plain
 * object captured in those worklets is a frozen snapshot that never sees a
 * later inset change. The animated `iconComponent` lives in the context rather
 * than upstream's module-level `let AnimatedIcon`.
 */
export type HoldMenuInternalContextType = {
  state: SharedValue<CONTEXT_MENU_STATE>;
  theme: SharedValue<'light' | 'dark'>;
  menuProps: SharedValue<MenuInternalProps>;
  safeAreaInsets: SharedValue<HoldMenuSafeAreaInsets>;
  /** Rotation-safe window metrics, mirrored from `useWindowDimensions`. */
  windowSize: SharedValue<HoldMenuWindowSize>;
  /**
   * The provider root's measured height — the containing block the menu clamps
   * within. Activation `measure(rootRef)`-s the root and stores it here so the
   * travel math clamps against the root's real bottom rather than the window's
   * (the two differ whenever the root is inset from the window — storybook's
   * padding decorator, a menu nested inside a scroll view — or when the root
   * does not fill the screen). Falls back to `windowSize.height` until the first
   * activation measures it.
   */
  rootHeight: SharedValue<number>;
  /** The provider's `iconComponent`, animated — or `null` when none was given. */
  AnimatedIcon: HoldMenuIconComponent | null;
  /**
   * Ref to the provider's root `Animated.View` — the containing block the
   * `Menu`'s absolute positioning is relative to. `measure(rootRef)` yields its
   * page offset, which activation subtracts from the held item's page coords so
   * the menu anchors correctly even when the root is offset from the viewport
   * origin (e.g. storybook's padding decorator on web).
   */
  rootRef: AnimatedRef<Animated.View>;
};

export const HoldMenuInternalContext = createContext<HoldMenuInternalContextType | null>(null);

/** Reads the HoldMenu internal context. Must be called under a `HoldMenuProvider`. */
export const useHoldMenuInternal = (): HoldMenuInternalContextType => {
  const context = useContext(HoldMenuInternalContext);
  if (!context) throw new Error('HoldMenu components must be used within a <HoldMenuProvider>.');
  return context;
};
