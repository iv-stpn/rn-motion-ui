import { createContext, useContext } from 'react';
import type Animated from 'react-native-reanimated';
import type { AnimatedRef, SharedValue } from 'react-native-reanimated';
import type { OverlayType } from '../Overlay/overlay-type';
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
  glass?: boolean;
  floating?: boolean;
  state: SharedValue<CONTEXT_MENU_STATE>;
  theme: SharedValue<'light' | 'dark'>;
  menuProps: SharedValue<MenuInternalProps>;
  safeAreaInsets: SharedValue<HoldMenuSafeAreaInsets>;
  /** Rotation-safe window metrics, mirrored from `useWindowDimensions`. */
  windowSize: SharedValue<HoldMenuWindowSize>;
  /**
   * The provider root's visible extent — the travel clamp's viewport height.
   * Activation `measure(rootRef)`-s the root each time and stores the part of
   * its coordinate space the user can actually see (the root's measured height
   * capped to the window's bottom edge relative to the root's top), so the
   * travel math clamps against the root's real bottom rather than the window's
   * (the two differ whenever the root is inset from the window — storybook's
   * padding decorator — or taller than it because it sits inside a scrollable
   * container, where its measured height is the full content height). Falls
   * back to `windowSize.height` until the first activation measures it.
   */
  rootViewportHeight: SharedValue<number>;
  /** The provider's `iconComponent`, animated — or `null` when none was given. */
  AnimatedIcon: HoldMenuIconComponent | null;
  /** Which scrim to show behind the menu: `"blur"`, `"opacity"`, or `"none"`. */
  overlay: OverlayType;
  /** Whether tapping the backdrop dismisses the menu. */
  closeOnOutsidePress: boolean;
  /**
   * Ref to the provider's root `Animated.View` — the containing block the
   * `Menu`'s absolute positioning is relative to. `measure(rootRef)` yields its
   * page offset, which activation subtracts from the held item's page coords so
   * the menu anchors correctly even when the root is offset from the viewport
   * origin (e.g. storybook's padding decorator on web).
   */
  rootRef: AnimatedRef<Animated.View>;
  /**
   * The root's page offset (`measure(rootRef).pageX/pageY`), stored by
   * activation. The menu/twins compute their `top`/`left` in the root's
   * coordinate space (item page coords minus this offset). When the overlay is
   * teleported to the `BlurProvider`'s overlay host — a sibling of the
   * `BlurTarget` whose origin is the `BlurProvider`'s parent, not the window —
   * those root-space coords must be converted into host space by adding this
   * offset back and subtracting the host's own window offset (see `teleported`
   * and `overlay-host-position`).
   */
  rootPageX: SharedValue<number>;
  rootPageY: SharedValue<number>;
  /**
   * Whether the overlay (backdrop + menu + twins) renders OUTSIDE the
   * `BlurTarget` through the `BlurProvider` overlay host (Android with the peer
   * installed) rather than inline inside the root. Teleported pieces convert
   * their root-space `top`/`left` into host space by adding `rootPageX`/`rootPageY`
   * and subtracting the host's own window offset — because the host's containing
   * block is the `BlurProvider`'s parent (inset from the window whenever anything
   * sits above the provider), not the window.
   */
  teleported: boolean;
};

export const HoldMenuInternalContext = createContext<HoldMenuInternalContextType | null>(null);

/**
 * Reads the HoldMenu internal context. Must be called under a `HoldMenuProvider`.
 *
 * Every consumer resolves through React context, including the pieces that
 * render OUTSIDE the provider's React tree: the `BlurProvider` overlay host is a
 * sibling of the `BlurTarget`, so HoldMenu's backdrop/menu/twins are teleported
 * there through `overlay-host`, and every one of those teleports wraps the node
 * it hands over in this provider's value (see `hold-menu-overlay-portal`).
 * Context does not cross the host boundary on its own, so the value has to
 * travel WITH the node — a module-level mirror of it used to stand in for that,
 * and any provider unmounting mid-flight nulled the slot another (or a
 * still-registered) entry depended on, which is what threw "must be used within
 * a `<HoldMenuProvider>`" on Android.
 */
export const useHoldMenuInternal = (): HoldMenuInternalContextType => {
  const value = useContext(HoldMenuInternalContext);
  if (!value) throw new Error('HoldMenu components must be used within a <HoldMenuProvider>.');
  return value;
};
