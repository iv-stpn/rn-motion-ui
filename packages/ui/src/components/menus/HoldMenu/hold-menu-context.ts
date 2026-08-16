import { createContext, useContext } from 'react';
import type Animated from 'react-native-reanimated';
import type { AnimatedRef, SharedValue } from 'react-native-reanimated';
import type { CONTEXT_MENU_STATE } from './hold-menu-constants';
import type { HoldMenuIconComponent, MenuInternalProps } from './hold-menu-types';

/** Safe-area insets the menu keeps clear of. */
export type HoldMenuSafeAreaInsets = { top: number; right: number; bottom: number; left: number };

/** Rotation-safe window metrics, fed from `useWindowDimensions`. */
export type HoldMenuWindowSize = { width: number; height: number; fontScale: number };

/**
 * What `HoldMenuProvider` shares with every `HoldItem`, the `Menu` and the
 * `Backdrop` — the shared values upstream carries in its `InternalContext`.
 *
 * Unlike upstream, the animated icon component also lives here (upstream keeps
 * a module-level exported `let AnimatedIcon` in its provider file, which this
 * port deliberately does not replicate — a module-level mutable is a smell, and
 * the context is the natural home for a value the menu items all need).
 */
export type HoldMenuInternalContextType = {
  state: SharedValue<CONTEXT_MENU_STATE>;
  theme: SharedValue<'light' | 'dark'>;
  menuProps: SharedValue<MenuInternalProps>;
  safeAreaInsets: SharedValue<HoldMenuSafeAreaInsets>;
  windowSize: SharedValue<HoldMenuWindowSize>;
  /** 1 when the user prefers reduced motion — durations collapse to 0. */
  reducedMotion: SharedValue<0 | 1>;
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

/**
 * Reads the HoldMenu internal context — `state`, `theme`, `menuProps`, the
 * rotation-safe `windowSize` / `safeAreaInsets` shared values, `reducedMotion`
 * and the animated `iconComponent`. Must be called under a `HoldMenuProvider`.
 */
export const useHoldMenuInternal = (): HoldMenuInternalContextType => {
  const context = useContext(HoldMenuInternalContext);
  if (!context) throw new Error('HoldMenu components must be used within a <HoldMenuProvider>.');
  return context;
};
