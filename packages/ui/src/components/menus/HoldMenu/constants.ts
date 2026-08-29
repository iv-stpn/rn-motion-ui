import { Platform } from 'react-native';

/**
 * Timing and motion constants for `HoldMenu`, ported verbatim from
 * react-native-hold-menu's `constants.ts`.
 *
 * Upstream also read `WINDOW_HEIGHT` / `WINDOW_WIDTH` / `MENU_WIDTH` /
 * `FONT_SCALE` from `Dimensions` at module scope there. Those are deliberately
 * absent here: module-level dimensions go stale on rotation and read wrong on
 * web, so every layout value in this component family comes from a
 * rotation-safe `useWindowDimensions`-fed shared value instead. The constants
 * that ARE here are the ones that are truly constant — the durations, springs
 * and enum that are the library's character.
 */

/** Duration of the menu/backdrop cross-fade and the lift handover, in ms. */
export const HOLD_ITEM_TRANSFORM_DURATION = 150;

/** Scale the held item is squeezed to before it lifts. */
export const HOLD_ITEM_SCALE_DOWN_VALUE = 0.95;

/** How long the squeeze-down takes, in ms. */
export const HOLD_ITEM_SCALE_DOWN_DURATION = 210;

/** Spring the item copy travels with — upstream's `SPRING_CONFIGURATION`. */
export const SPRING_CONFIGURATION = {
  damping: 33,
  mass: 1.03,
  stiffness: 500,
  restDisplacementThreshold: 0.001,
  restSpeedThreshold: 0.001,
} as const;

/** Spring the menu panel pops in with — upstream's `SPRING_CONFIGURATION_MENU`. */
export const SPRING_CONFIGURATION_MENU = {
  damping: 39,
  mass: 1.09,
  stiffness: 500,
  restDisplacementThreshold: 0.001,
  restSpeedThreshold: 0.001,
} as const;

/**
 * Lifecycle of the menu, driven through the provider's `state` shared value.
 * Upstream declares a TS `enum`; a const object is the biome-clean equivalent
 * with the same call sites (`CONTEXT_MENU_STATE.ACTIVE`).
 */
export const CONTEXT_MENU_STATE = {
  UNDETERMINED: 0,
  ACTIVE: 1,
  END: 2,
} as const;

/** One of the {@link CONTEXT_MENU_STATE} values. */
export type CONTEXT_MENU_STATE = (typeof CONTEXT_MENU_STATE)[keyof typeof CONTEXT_MENU_STATE];

/** Half-width tolerance inside which an item counts as centred on screen. */
export const MENU_TRANSFORM_ORIGIN_TOLERENCE = 10;

/** The panel is at most this fraction of the window width — upstream's `MENU_WIDTH` formula, lowered from upstream's 0.6. A content-fit panel caps here so a long label wraps instead of running past the edge. */
export const MENU_WIDTH_RATIO = 0.4;

/** Smallest the panel is ever drawn — content that measures below this still gets a full-width-looking panel. */
export const MENU_MIN_WIDTH = 160;

/** Margin kept between the panel and the safe-area edges. */
export const HOLD_MENU_VIEWPORT_PADDING = 8;

/**
 * Whether activation is transported through the DOM event system rather than
 * react-native-gesture-handler.
 *
 * True on web, where `'hold'` is a right-click (the wrapper's `contextmenu`
 * handler — browsers also raise it for Shift+F10 and the ContextMenu key on a
 * focused element) and `'tap'` / `'double-tap'` are plain `onClick`s. RNGH web
 * gestures need trusted pointer events, which synthetic clicks (tests,
 * automation) cannot produce, so web uses DOM events for activation and for
 * backdrop dismissal instead. The lift itself — the portal twin of the
 * children, the squeeze that hides the original, and the travel that moves the
 * pair — happens on every platform.
 *
 * This is the single platform check in the component family.
 */
export const IS_WEB = Platform.OS === 'web';
