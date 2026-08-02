/**
 * The `motion` prop of `HoldContextMenu` — the shared anchored-menu contract plus
 * the two moving parts only this menu has.
 *
 * Its own module rather than a field in the overlay, so a consumer can name the
 * type without importing the overlay's React tree.
 */

import type { MenuMotion, MotiTransitionProp } from '../../../theme/motion';

/**
 * Transition overrides for the hold menu.
 *
 * `enter`, `exit`, `scale` and `offset` are the same four knobs every anchored
 * menu in the package takes ({@link MenuMotion}) and do the same thing here, so a
 * dropdown and a hold menu tuned the same way move the same way. `scrim` and
 * `lift` are the extra surfaces this one animates.
 *
 * Reduced motion wins over all of it — the panel cross-fades in place and nothing
 * lifts.
 *
 * @example
 * // The iOS pop this component shipped with before it was standardised.
 * <HoldContextMenu motion={{ scale: 0.6, offset: 0 }} items={items}>…</HoldContextMenu>
 */
export type HoldContextMenuMotion = MenuMotion & {
  /**
   * Dim/blur fade behind the menu, both ways. Fades even under reduced motion: a
   * scrim appearing is information, not movement.
   * @default MENU_SCRIM_TRANSITION
   */
  scrim?: Partial<MotiTransitionProp>;
  /**
   * The held item rising off the page. Native-only — nothing lifts on web.
   *
   * Defaults to `enter`, so the item and the panel it belongs to arrive as one
   * thing. It always leaves on `exit`, since `AnimatePresence` keeps the overlay
   * mounted until its slowest child has gone.
   * @default the resolved `enter` transition
   */
  lift?: Partial<MotiTransitionProp>;
};
