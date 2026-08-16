/**
 * Placement math for `HoldMenu` — the pure, React-free geometry the panel
 * and the held item's portal copy animate with.
 *
 * Every function here is upstream react-native-hold-menu's
 * (`utils/calculations.ts`, `components/menu/calculations.ts` and the
 * `calculateTransformValue` worklet from `HoldItem.tsx`), ported as pure
 * functions that take their inputs as arguments instead of reading shared
 * values or module constants. That is what makes them unit-testable without a
 * renderer, and it is what makes them rotation-safe: window dimensions are
 * passed in from a `useWindowDimensions`-fed shared value, never read from
 * `Dimensions` at import time.
 *
 * Two deliberate departures from upstream, both carried over from the sibling
 * `HoldMenu` port (they were proven there):
 *
 * - **Travel clamping** — upstream shifts the item+panel pair by the full
 *   overflow unconditionally, which can push the held item clean off the
 *   opposite edge. Here the travel stops as soon as the item would leave the
 *   safe area, and whatever overflow the shift could not absorb comes off the
 *   panel's `maxHeight`, which the panel scrolls.
 * - **Viewport clamping** — upstream offsets the panel from the item and lets
 *   the result run off-screen; here the absolute left is clamped into the safe
 *   viewport.
 *
 * Functions carry the `'worklet'` directive (inert when called as plain
 * functions from JS, which is how the unit tests exercise them) so Reanimated
 * can run them on the UI thread.
 */

import { HOLD_MENU_VIEWPORT_PADDING, MENU_TRANSFORM_ORIGIN_TOLERENCE } from './constants';
import {
  MENU_TEXT_DARK_COLOR,
  MENU_TEXT_DESTRUCTIVE_COLOR_DARK,
  MENU_TEXT_DESTRUCTIVE_COLOR_LIGHT,
  MENU_TEXT_LIGHT_COLOR,
  MENU_TITLE_COLOR,
} from './hold-menu-theme';
import type { MenuItemProps, TransformOriginAnchorPosition } from './hold-menu-types';
import { SPACING, TYPOGRAPHY } from './style-guide';

function fieldAreSame(obj1: MenuItemProps, obj2: MenuItemProps): boolean {
  'worklet';

  const keys = Object.keys(obj1);

  return keys.every((key) => {
    // biome-ignore lint/plugin: Object.keys yields the item's own keys — the cast is safe by construction
    const val1 = obj1[key as keyof MenuItemProps];
    // biome-ignore lint/plugin: Object.keys yields the item's own keys — the cast is safe by construction
    const val2 = obj2[key as keyof MenuItemProps];

    if (val1 !== val2) {
      if (typeof val1 === 'function' && typeof val2 === 'function') return val1.toString() === val2.toString();
      return false;
    }

    return true;
  });
}

/**
 * Horizontal travel for one phase of the panel's pop-in — upstream's nested
 * ternary flattened to a function. `right` mirrors the left travel (the panel
 * grows out of the opposite side), `left` takes it straight, and the centre
 * (or any other half) falls back to the `center` value.
 */
function horizontalTravel(half: string | undefined, leftTravel: number, centerTravel: number): number {
  'worklet';
  if (half === 'right') return -leftTravel;
  if (half === 'left') return leftTravel;
  return centerTravel;
}

/**
 * Vertical travel for one phase of the panel's pop-in. `top` / `bottom` take
 * their travel straight; the centre falls back. Upstream's quirk (the
 * `bottom-*` beginning reuses the top value) is preserved by the caller passing
 * the same value for both.
 */
function verticalTravel(half: string | undefined, topTravel: number, bottomTravel: number, centerTravel: number): number {
  'worklet';
  if (half === 'top') return topTravel;
  if (half === 'bottom') return bottomTravel;
  return centerTravel;
}

/**
 * Worklet-safe deep equality for the item lists that cross the shared-value
 * boundary — upstream's `deepEqual` from `utils/validations.ts`, verbatim.
 */
export const deepEqual = (array1: MenuItemProps[], array2: MenuItemProps[]): boolean => {
  'worklet';

  const areArrays = Array.isArray(array1) && Array.isArray(array2);
  const areSameLength = areArrays && array2 && array1.length === array2.length;

  if (areArrays && areSameLength && array2)
    return array1.every((menuItem: MenuItemProps, index) => {
      const obj1 = menuItem;
      const obj2 = array2[index];
      if (!obj2) return false;

      return fieldAreSame(obj1, obj2);
    });

  return false;
};

/** Height of one action row at the given font scale — upstream's `MenuItemHeight()`. */
// biome-ignore lint/plugin: the 'worklet' directive requires a block body — a one-liner would be a string expression, not a directive
export const menuItemHeight = (fontScale: number): number => {
  'worklet';
  return TYPOGRAPHY.callout.lineHeight * fontScale + SPACING * 2.5;
};

/**
 * Estimated panel height for N rows and separator bands — upstream's
 * `calculateMenuHeight`, counting the inter-row 1 px seams it counts.
 */
// biome-ignore lint/plugin: the 'worklet' directive requires a block body — a one-liner would be a string expression, not a directive
export const calculateMenuHeight = (itemLength: number, separatorCount: number, fontScale = 1): number => {
  'worklet';
  return menuItemHeight(fontScale) * itemLength + (itemLength - 1) + separatorCount * SPACING;
};

/**
 * Beginning/ending transforms of the panel's pop-in animation, per anchor —
 * upstream's `menuAnimationAnchor`, with its nested ternaries flattened into
 * {@link horizontalTravel} / {@link verticalTravel} (behaviour unchanged,
 * including the quirk where the `bottom-*` beginning `translateY` reuses
 * `TyTop1`). `menuHeight` and `menuWidth` are parameterised so the panel's
 * rotation-safe size drives the animation.
 */
export const menuAnimationAnchor = (
  anchorPoint: TransformOriginAnchorPosition,
  itemWidth: number,
  menuHeight: number,
  menuWidth: number,
) => {
  'worklet';

  const anchorParts = anchorPoint.split('-');
  const verticalHalf = anchorParts[0];
  const horizontalHalf = anchorParts[1];

  const Center1 = itemWidth;
  const Center2 = 0;

  const TyTop1 = -(menuHeight / 2);
  const TyTop2 = menuHeight / 2;

  const TxLeft1 = (menuWidth / 2) * -1;
  const TxLeft2 = (menuWidth / 2) * 1;

  return {
    beginningTransformations: {
      translateX: horizontalTravel(horizontalHalf, TxLeft1, Center1),
      translateY: verticalTravel(verticalHalf, TyTop1, TyTop1, Center2),
    },
    endingTransformations: {
      translateX: horizontalTravel(horizontalHalf, TxLeft2, Center2),
      translateY: verticalTravel(verticalHalf, TyTop2, -TyTop2, Center2),
    },
  };
};

/**
 * Automatic anchor from the item's screen position — upstream's
 * `getTransformOrigin`: left half → left, right half → right, within
 * {@link MENU_TRANSFORM_ORIGIN_TOLERENCE} of centre → centre.
 */
export const getTransformOrigin = (
  posX: number,
  itemWidth: number,
  windowWidth: number,
  bottom?: boolean,
): TransformOriginAnchorPosition => {
  'worklet';
  const distanceToLeft = Math.round(posX + itemWidth / 2);
  const distanceToRight = Math.round(windowWidth - distanceToLeft);

  let position: TransformOriginAnchorPosition = bottom ? 'bottom-right' : 'top-right';

  const majority = Math.abs(distanceToLeft - distanceToRight);

  if (majority < MENU_TRANSFORM_ORIGIN_TOLERENCE) position = bottom ? 'bottom-center' : 'top-center';
  else if (distanceToLeft < distanceToRight) position = bottom ? 'bottom-left' : 'top-left';

  return position;
};

/** Inputs for the vertical travel resolution — upstream's `calculateTransformValue`, parameterised. */
export type HoldMenuTravelInput = {
  /** Window-space top of the held item (`measure().pageY`, root-offset-adjusted). */
  itemY: number;
  /** Measured height of the held item. */
  itemHeight: number;
  /** Estimated panel height, before any cap. */
  menuHeight: number;
  /** Pin the item — travel is always 0, the panel takes the whole overflow. */
  disableMove: boolean;
  /** Whether the panel opens below the item (`top-*` anchor vertical). */
  opensBelow: boolean;
  /** Current window height (rotation-safe). */
  windowHeight: number;
  /** Top safe-area inset. */
  safeTop: number;
  /** Bottom safe-area inset. */
  safeBottom: number;
};

/** Result of the travel / panel-cap resolution. */
export type HoldMenuTravel = {
  /** Vertical travel applied to item and panel; negative is up. */
  tY: number;
  /** Height the panel may occupy once shifted — its scroll cap. */
  maxHeight: number;
};

/**
 * How far item and panel travel together so the panel fits, and the height the
 * panel may occupy once they have.
 *
 * This is upstream's `calculateTransformValue` (tY nonzero only on overflow:
 * negative up when the menu runs off the bottom, positive down when it runs
 * off the top) with the safe-area clamp carried over from the sibling `HoldMenu`
 * port: the travel stops as soon as the item's trailing edge would leave the
 * safe area, and the residual overflow comes off `maxHeight`, which the panel
 * scrolls instead of the pair leaving the screen.
 */
export const resolveHoldMenuTravel = (input: HoldMenuTravelInput): HoldMenuTravel => {
  'worklet';
  const { itemY, itemHeight, menuHeight, disableMove, opensBelow, windowHeight, safeTop, safeBottom } = input;
  const gap = SPACING;
  const padding = HOLD_MENU_VIEWPORT_PADDING;

  if (opensBelow) {
    // Room between the item's bottom edge and the safe bottom.
    const room = windowHeight - safeBottom - padding - (itemY + itemHeight + gap);
    if (disableMove) return { tY: 0, maxHeight: Math.max(room, 0) };
    const overflow = menuHeight - room;
    if (overflow <= 0) return { tY: 0, maxHeight: room };
    // Travel up (negative) by the overflow, clamped so the item's top never
    // crosses the safe area; the panel caps to whatever room is left.
    const bound = Math.min(0, safeTop + padding - itemY);
    const tY = Math.max(-overflow, bound);
    return { tY, maxHeight: room + Math.abs(tY) };
  }

  // Room between the safe top and the item's top edge.
  const room = itemY - gap - safeTop - padding;
  if (disableMove) return { tY: 0, maxHeight: Math.max(room, 0) };
  const overflow = menuHeight - room;
  if (overflow <= 0) return { tY: 0, maxHeight: room };
  // Travel down (positive) by the overflow, clamped so the item's bottom never
  // crosses the safe area; the panel caps to whatever room is left.
  const bound = Math.max(0, windowHeight - safeBottom - padding - (itemY + itemHeight));
  const tY = Math.min(overflow, bound);
  return { tY, maxHeight: room + Math.abs(tY) };
};

/** The vertical travel — upstream's `calculateTransformValue`, clamped. */
// biome-ignore lint/plugin: the 'worklet' directive requires a block body — a one-liner would be a string expression, not a directive
export const calculateTransformValue = (input: HoldMenuTravelInput): number => {
  'worklet';
  return resolveHoldMenuTravel(input).tY;
};

/** The panel's scroll cap once travel has been applied. */
// biome-ignore lint/plugin: the 'worklet' directive requires a block body — a one-liner would be a string expression, not a directive
export const menuMaxHeight = (input: HoldMenuTravelInput): number => {
  'worklet';
  return resolveHoldMenuTravel(input).maxHeight;
};

/**
 * Smallest the panel is ever capped to: one row. A panel clamped below this
 * shows no whole row at all, and the held item can afford to hang off the edge
 * instead.
 */
export const MIN_PANEL_HEIGHT = TYPOGRAPHY.callout.lineHeight + SPACING * 2.5;

/**
 * The height the panel actually renders at: the estimate, capped to what fits
 * after travel — never below one row.
 */
// biome-ignore lint/plugin: the 'worklet' directive requires a block body — a one-liner would be a string expression, not a directive
export const menuPanelHeight = (menuHeight: number, maxHeight: number): number => {
  'worklet';
  return Math.min(menuHeight, Math.max(maxHeight, MIN_PANEL_HEIGHT));
};

/** Inputs for the horizontal viewport clamp. */
export type HoldMenuLeftClampInput = {
  /** Raw panel left — the item's left plus `leftOrRight`. */
  left: number;
  /** Panel width (rotation-safe). */
  menuWidth: number;
  /** Current window width (rotation-safe). */
  windowWidth: number;
  /** Left safe-area inset. */
  safeLeft: number;
  /** Right safe-area inset. */
  safeRight: number;
};

/**
 * Clamps the panel's absolute left into the safe viewport — a departure from
 * upstream, which lets a narrow item near an edge push the panel off-screen.
 */
export const clampMenuLeft = ({ left, menuWidth, windowWidth, safeLeft, safeRight }: HoldMenuLeftClampInput): number => {
  'worklet';
  const padding = HOLD_MENU_VIEWPORT_PADDING;
  const min = safeLeft + padding;
  const max = Math.max(min, windowWidth - safeRight - padding - menuWidth);
  return Math.min(Math.max(left, min), max);
};

/**
 * Panel's left offset relative to the item wrapper — upstream's `leftOrRight`,
 * made pure (note the centre case's odd `-itemWidth - menuWidth/2 + itemWidth/2`).
 */
export const leftOrRight = (anchorPosition: TransformOriginAnchorPosition, itemWidth: number, menuWidth: number): number => {
  'worklet';
  const anchorPositionHorizontal = anchorPosition.split('-')[1];

  if (anchorPositionHorizontal === 'right') return -menuWidth + itemWidth;
  if (anchorPositionHorizontal === 'left') return 0;
  // Centre — upstream's verbatim formula; the viewport clamp keeps it on screen.
  return -itemWidth - menuWidth / 2 + itemWidth / 2;
};

/** Inputs for resolving the anchor's horizontal half with an overflow fallback. */
export type HoldMenuAnchorResolveInput = {
  /** The hinted (or auto-picked) anchor to try first. */
  anchor: TransformOriginAnchorPosition;
  /** Window-space left of the held item (`itemX`). */
  itemX: number;
  /** Measured width of the held item. */
  itemWidth: number;
  /** Panel width (rotation-safe). */
  menuWidth: number;
  /** Current window width (rotation-safe). */
  windowWidth: number;
  /** Left safe-area inset. */
  safeLeft: number;
  /** Right safe-area inset. */
  safeRight: number;
};

/**
 * The horizontal half of an anchor, with an overflow fallback.
 *
 * The automatic anchor (`getTransformOrigin`) already points the panel toward
 * the screen centre, but an explicit `menuAnchorPosition` hint can point the
 * wrong way — e.g. a `top-right` hint on an item hugging the left edge would
 * push the panel off-screen left. When the hinted side would overflow the safe
 * viewport, the opposite side (which by construction fits) is used instead; the
 * hint is left alone only when the opposite side would overflow too, so the
 * viewport clamp in {@link clampMenuLeft} becomes the last resort.
 */
export const resolveMenuAnchorPosition = ({
  anchor,
  itemX,
  itemWidth,
  menuWidth,
  windowWidth,
  safeLeft,
  safeRight,
}: HoldMenuAnchorResolveInput): TransformOriginAnchorPosition => {
  'worklet';
  const vertical = anchor.split('-')[0];
  const horizontal = anchor.split('-')[1];
  const padding = HOLD_MENU_VIEWPORT_PADDING;
  const min = safeLeft + padding;
  const max = windowWidth - safeRight - padding - menuWidth;

  // Full anchor for a horizontal half, so the flip never needs an `as` cast on
  // a template literal.
  const anchorFor = (h: 'left' | 'right' | 'center'): TransformOriginAnchorPosition => {
    if (vertical === 'bottom') {
      if (h === 'left') return 'bottom-left';
      if (h === 'right') return 'bottom-right';
      return 'bottom-center';
    }
    if (h === 'left') return 'top-left';
    if (h === 'right') return 'top-right';
    return 'top-center';
  };

  const panelLeft = (h: 'left' | 'right' | 'center'): number => itemX + leftOrRight(anchorFor(h), itemWidth, menuWidth);

  const overflows = (h: 'left' | 'right' | 'center'): boolean => {
    const left = panelLeft(h);
    return left < min || left > max;
  };

  if (horizontal === 'right' && overflows('right') && !overflows('left')) return anchorFor('left');
  if (horizontal === 'left' && overflows('left') && !overflows('right')) return anchorFor('right');
  return anchor;
};

/** Row text colour from the item flags and theme — upstream's `getColor`. */
export const getColor = (isTitle: boolean | undefined, isDestructive: boolean | undefined, themeValue: 'light' | 'dark') => {
  'worklet';
  if (isTitle) return MENU_TITLE_COLOR;
  if (isDestructive) return themeValue === 'dark' ? MENU_TEXT_DESTRUCTIVE_COLOR_DARK : MENU_TEXT_DESTRUCTIVE_COLOR_LIGHT;
  return themeValue === 'dark' ? MENU_TEXT_DARK_COLOR : MENU_TEXT_LIGHT_COLOR;
};
