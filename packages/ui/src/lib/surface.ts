/**
 * surface — the shared surface-container class helper.
 *
 * A surface container is any panel whose fill, float shadow and corner radius
 * should move together: cards, menus, modals, sheets, drawers. This combines
 * the two halves those containers currently spell by hand:
 *
 *  - the corner-radius token (`rounded-card` / `rounded-menu` / `rounded-modal`,
 *    from {@link ROUNDED_CARD} et al. in radius.ts), and
 *  - the elevation ladder (`bg-surface-N` + `shadow-elevated-N`, from
 *    {@link elevated}).
 *
 * Callers whose radius is *not* one of the three tokens (a `rounded-2xl` card, a
 * `rounded-t-modal` sheet) pass no `radius` and keep that class beside the
 * result — the elevation half is still shared. `0` is the flat resting surface:
 * a `surface-3` fill with no shadow or border.
 *
 * Every class is spelled as a static literal so the uniwind/Tailwind scanner
 * registers `rounded-*` / `bg-surface-N` / `shadow-elevated-N` — never build
 * these by string concatenation from a bare number.
 */

import { cn } from './cn';
import { elevated, type SurfaceElevation } from './elevated';
import { ROUNDED_CARD, ROUNDED_MENU, ROUNDED_MODAL } from './radius';

// Static literal map — the scanner reads the class names from these values.
const SURFACE_RADIUS_CLASS: Record<SurfaceRadius, string> = {
  card: ROUNDED_CARD,
  menu: ROUNDED_MENU,
  modal: ROUNDED_MODAL,
};

/** Corner-radius token for a surface container — maps to the radius utility class. */
export type SurfaceRadius = 'card' | 'menu' | 'modal';

/**
 * Surface classes for an elevation: the radius token (when given) plus the
 * ladder `bg-surface-N shadow-elevated-N`. At `0` the surface is flat —
 * `bg-surface-3` alone, no shadow or border. Omit `radius` to keep the
 * caller's own corner class (a non-token radius like `rounded-2xl`).
 */
export function surface(elevation: SurfaceElevation, radius?: SurfaceRadius): string {
  return cn(radius ? SURFACE_RADIUS_CLASS[radius] : undefined, elevated(elevation));
}
