import { Platform } from 'react-native';

/**
 * Timing and motion constants for `HoldMenu`, ported verbatim from
 * react-native-hold-menu's `constants.ts`.
 *
 * Upstream also read `WINDOW_HEIGHT` / `WINDOW_WIDTH` / `MENU_WIDTH` /
 * `FONT_SCALE` from `Dimensions` at module scope there. Those are deliberately
 * absent here: module-level dimensions go stale on rotation, so every layout
 * value in this component family comes from a rotation-safe
 * `useWindowDimensions`-fed shared value instead. The constants that ARE here
 * are the ones that are truly constant — the durations, springs and enum that
 * are the library's character.
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

/** The panel is this fraction of the window width — upstream's `MENU_WIDTH` formula. */
export const MENU_WIDTH_RATIO = 0.6;

/** Margin kept between the panel and the safe-area edges. */
export const HOLD_MENU_VIEWPORT_PADDING = 8;

/** True on iOS — the only platform upstream blurs with expo-blur. */
export const IS_IOS = Platform.OS === 'ios';

/**
 * Whether this platform can blur what sits behind the backdrop — iOS via
 * expo-blur, web via CSS `backdrop-filter`. These get the translucent backdrop
 * colors; platforms without blur (Android) get the near-opaque plain dim,
 * exactly as upstream.
 */
export const BACKDROP_BLURS = Platform.OS === 'ios' || Platform.OS === 'web';

/**
 * Whether this platform performs the lift — hold the item, it rises off a
 * dimmed page and the panel pops out beside it.
 *
 * False on web, where the interaction is a right-click that opens a plain
 * dropdown anchored to the item. A mouse already has a button for exactly this,
 * so asking someone to hold one down is a touch idiom imported where it does
 * not belong. `activateOn` of `'tap'` / `'double-tap'` still uses the press on
 * web — those read the same with a mouse — so this switches off only the
 * lift-shaped parts: the portal twin of the children, the squeeze that hides
 * the original, and the travel that moves the pair on screen.
 *
 * This is the single platform check in the component family.
 */
export const HOLD_MENU_LIFTS = Platform.OS !== 'web';
