/**
 * Placement math for `HoldContextMenu` — where the panel lands relative to the
 * item that was held, and how far the two travel together to stay on screen.
 *
 * Pure and React-free, so the geometry is unit-testable without mounting a modal
 * or faking a `measureInWindow`. The component owns measurement, gestures and
 * animation; this module owns arithmetic.
 *
 * Ported from react-native-hold-menu's `utils/calculations.ts` and
 * `HoldItem.calculateTransformValue`, with two deliberate departures — see
 * `resolveTravel` (travel clamping) and `resolveLeft` (viewport clamping).
 *
 * Internals come first so every `export` sits in one run at the end of the file
 * (`useExportsLast`). They reference exported types ahead of declaration, which
 * type positions allow, and exported metric constants from inside function
 * bodies, which only run after module initialisation.
 */

import { type MenuTransformOrigin, menuTransformOrigin } from '../../../theme/motion';

// ── Internals ────────────────────────────────────────────────────────────────

/** Half-width tolerance inside which an item counts as centred on screen. */
const CENTER_TOLERANCE = 10;

type SideInput = {
  side: HoldMenuSide;
  item: HoldMenuRect;
  menuHeight: number;
  viewport: HoldMenuViewport;
  insets: HoldMenuInsets;
};
type AlignInput = { align: HoldMenuAlign; item: HoldMenuRect; viewport: HoldMenuViewport };
type SpaceInput = { side: ResolvedHoldMenuSide; item: HoldMenuRect; viewport: HoldMenuViewport; insets: HoldMenuInsets };
type LeftInput = {
  align: ResolvedHoldMenuAlign;
  item: HoldMenuRect;
  width: number;
  viewport: HoldMenuViewport;
  insets: HoldMenuInsets;
};
type TravelInput = SpaceInput & { menuHeight: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** Room for the panel between the item's edge on `side` and the safe area. */
function spaceOn({ side, item, viewport, insets }: SpaceInput) {
  if (side === 'bottom')
    return viewport.height - insets.bottom - HOLD_MENU_VIEWPORT_PADDING - (item.y + item.height + HOLD_MENU_GAP);
  return item.y - HOLD_MENU_GAP - insets.top - HOLD_MENU_VIEWPORT_PADDING;
}

/**
 * Which side of the item the panel opens on. `'auto'` prefers below, and flips
 * above only when below cannot fit the panel and above can fit more of it.
 */
function resolveSide({ side, item, menuHeight, viewport, insets }: SideInput): ResolvedHoldMenuSide {
  if (side !== 'auto') return side;
  const below = spaceOn({ side: 'bottom', item, viewport, insets });
  if (menuHeight <= below) return 'bottom';
  const above = spaceOn({ side: 'top', item, viewport, insets });
  return above > below ? 'top' : 'bottom';
}

/**
 * Which edge the panel aligns to. `'auto'` picks the side of the screen the
 * item's midpoint sits on, so the panel grows toward the roomier half —
 * react-native-hold-menu's `getTransformOrigin`, tolerance included.
 */
function resolveAlign({ align, item, viewport }: AlignInput): ResolvedHoldMenuAlign {
  if (align !== 'auto') return align;
  const toLeft = Math.round(item.x + item.width / 2);
  const toRight = Math.round(viewport.width - toLeft);
  if (Math.abs(toLeft - toRight) < CENTER_TOLERANCE) return 'center';
  return toLeft < toRight ? 'start' : 'end';
}

/**
 * Panel left edge, clamped into the safe viewport.
 *
 * The clamp is an addition: react-native-hold-menu offsets from the item and
 * lets the result run off-screen for a narrow item near an edge (its menu is a
 * fixed 60% of screen width, so a centred alignment on a 40 px item overhangs by
 * design). Clamping keeps the whole panel reachable, at the cost of the panel's
 * edge no longer lining up with the item's when the item is close to an edge.
 */
function resolveLeft({ align, item, width, viewport, insets }: LeftInput) {
  const min = insets.left + HOLD_MENU_VIEWPORT_PADDING;
  const max = Math.max(min, viewport.width - insets.right - HOLD_MENU_VIEWPORT_PADDING - width);
  if (align === 'start') return clamp(item.x, min, max);
  if (align === 'end') return clamp(item.x + item.width - width, min, max);
  return clamp(item.x + item.width / 2 - width / 2, min, max);
}

/**
 * How far item and panel travel together so the panel fits, and the height the
 * panel may occupy once they have. Negative `shift` is up.
 *
 * The clamp is the second departure from react-native-hold-menu, whose
 * `calculateTransformValue` shifts by the full overflow unconditionally: a panel
 * taller than the viewport pushes the held item clean off the opposite edge,
 * leaving the user holding something they can no longer see. Here the travel
 * stops as soon as the item would leave the safe area — the *whole* item, not
 * just an edge of it, since it is what the menu is about — and whatever overflow
 * the shift could not absorb comes off `maxHeight`, which the panel scrolls.
 *
 * The two are resolved together because for `side: 'top'` the panel's top edge
 * is `item.y - gap - height`: cap the height without recomputing that edge and
 * the panel hangs off the top by exactly what was trimmed.
 */
function resolveTravel({ side, item, menuHeight, viewport, insets }: TravelInput) {
  const room = spaceOn({ side, item, viewport, insets });
  const overflow = menuHeight - room;
  if (overflow <= 0) return { shift: 0, maxHeight: room };

  // Travel away from the panel: down when it opens above, up when it opens below.
  const wanted = side === 'top' ? overflow : -overflow;
  // How far the item can go before its trailing edge crosses the safe area. The
  // `max`/`min` keeps an item already outside it from being dragged further out.
  const bound =
    side === 'top'
      ? Math.max(0, viewport.height - insets.bottom - HOLD_MENU_VIEWPORT_PADDING - (item.y + item.height))
      : Math.min(0, insets.top + HOLD_MENU_VIEWPORT_PADDING - item.y);
  const shift = side === 'top' ? Math.min(wanted, bound) : Math.max(wanted, bound);

  return { shift, maxHeight: room + Math.abs(shift) };
}

// ── Types ────────────────────────────────────────────────────────────────────

/** Window-space rect of the held item, as returned by `measureInWindow`. */
export type HoldMenuRect = { x: number; y: number; width: number; height: number };

/** Window dimensions the panel is placed and clamped within. */
export type HoldMenuViewport = { width: number; height: number };

/** Safe-area insets kept clear of the panel. */
export type HoldMenuInsets = { top: number; bottom: number; left: number; right: number };

/**
 * Which side of the held item the panel opens on. `'auto'` prefers `'bottom'`
 * and flips when there is more room above.
 *
 * Replaces react-native-hold-menu's `bottom` boolean and the vertical half of
 * its `menuAnchorPosition`: `bottom={false}` is `side="bottom"` (panel *below*
 * the item), `bottom={true}` is `side="top"`.
 */
export type HoldMenuSide = 'top' | 'bottom' | 'auto';

/**
 * Which edge of the held item the panel aligns to. `'auto'` picks the side with
 * more room, matching react-native-hold-menu's automatic anchor.
 *
 * Replaces the horizontal half of its `menuAnchorPosition`: `*-left` is
 * `'start'`, `*-right` is `'end'`, `*-center` is `'center'`.
 */
export type HoldMenuAlign = 'start' | 'center' | 'end' | 'auto';

export type ResolvedHoldMenuSide = Exclude<HoldMenuSide, 'auto'>;
export type ResolvedHoldMenuAlign = Exclude<HoldMenuAlign, 'auto'>;

/** Only the fields that affect a row's height. */
export type HoldMenuHeightItem = { heading?: boolean; separator?: boolean };

export type HoldMenuLayoutInput = {
  /** Measured window rect of the held item. */
  item: HoldMenuRect;
  /** Estimated (or measured) panel height. */
  menuHeight: number;
  /** Requested panel width, before viewport clamping. */
  menuWidth: number;
  viewport: HoldMenuViewport;
  insets: HoldMenuInsets;
  side?: HoldMenuSide;
  align?: HoldMenuAlign;
  /** When true, `shift` is forced to 0 and the panel may overflow. */
  disableMove?: boolean;
};

export type HoldMenuLayout = {
  /** Resolved side the panel opens on. */
  side: ResolvedHoldMenuSide;
  /** Resolved edge the panel aligns to. */
  align: ResolvedHoldMenuAlign;
  /** Panel left edge in window space. */
  left: number;
  /** Panel top edge in window space, *before* `shift` is applied. */
  top: number;
  /** Panel width after clamping to the safe viewport. */
  width: number;
  /** Vertical travel applied to both item and panel; negative is up. */
  shift: number;
  /** Height the panel may occupy once shifted — its scroll cap. */
  maxHeight: number;
  /**
   * CSS `transform-origin` for the panel's scale-in, so it grows out of the
   * corner nearest the item. From the shared `menuTransformOrigin`, so the panel
   * grows out of its corner the same way every other anchored menu's does.
   */
  transformOrigin: MenuTransformOrigin;
};

// ── Metrics ──────────────────────────────────────────────────────────────────

/**
 * Row and panel metrics, in px, each paired with the Tailwind class that
 * produces it. The panel's rows are `Menu` rows, whose height comes from padding
 * plus a text line box — which is a font measurement, not a number this module
 * can know. So the panel pins its own floor with the `*_CLASS` strings below and
 * mirrors it here, and the pair being declared together is what keeps the two in
 * step. Apply the class without updating the number and the pre-layout estimate
 * drifts; the panel then opens a few px off until its first `onLayout` lands.
 *
 * The classes are floors (`min-h-*`), not fixed heights: a large accessibility
 * font must grow a row rather than clip its label. When that happens the
 * estimate under-reports, `onLayout` reports the real height, and the layout
 * re-resolves — the documented correction path, not a failure.
 */

/** Action row minimum height. */
export const HOLD_MENU_ROW_HEIGHT = 32;
/** Floor applied to each action row, mirroring {@link HOLD_MENU_ROW_HEIGHT}. */
export const HOLD_MENU_ROW_CLASS = 'min-h-8';
/** Heading row minimum height. */
export const HOLD_MENU_HEADING_HEIGHT = 24;
/** Floor applied to the heading row, mirroring {@link HOLD_MENU_HEADING_HEIGHT}. */
export const HOLD_MENU_HEADING_CLASS = 'min-h-6 justify-center';
/**
 * The list's vertical inset inside the panel. `Menu` ships a default one, but
 * this panel overrides it with a number of its own: the estimate below has to be
 * exact, and a value the list is free to retune is not one to predict a position
 * from.
 */
export const HOLD_MENU_LIST_PADDING = 8;
/** Vertical inset applied to the list, mirroring {@link HOLD_MENU_LIST_PADDING}. */
export const HOLD_MENU_LIST_CLASS = 'py-1';
/**
 * Separator band between groups — `Menu`'s own `md` separator: a `h-1` hairline
 * with `my-1` around it. Explicit in `Menu`'s size scale, so unlike the rows
 * above there is nothing to pin here, only to mirror.
 *
 * Mirrored rather than imported: this module is pure geometry with no component
 * imports, which is what lets it be unit-tested without a renderer. The source of
 * truth is `MENU_SEPARATOR_HEIGHT.md` in `../Menu/menu`, whose doc comment points
 * back here.
 */
export const HOLD_MENU_SEPARATOR_HEIGHT = 10;
/** Panel hairline border, top + bottom — `border`. */
export const HOLD_MENU_BORDER_HEIGHT = 2;
/**
 * Smallest the panel is ever capped to: border, list inset and one row. A panel
 * clamped below this shows no whole row at all, and the held item is the thing
 * that can afford to hang off the edge instead.
 */
export const HOLD_MENU_MIN_PANEL_HEIGHT = HOLD_MENU_BORDER_HEIGHT + HOLD_MENU_LIST_PADDING + HOLD_MENU_ROW_HEIGHT;
/** Gap between the held item's edge and the panel. */
export const HOLD_MENU_GAP = 8;
/** Margin kept between the panel and the safe-area edges. */
export const HOLD_MENU_VIEWPORT_PADDING = 8;
/** Default panel width, before clamping to the viewport. */
export const HOLD_MENU_DEFAULT_WIDTH = 240;
/**
 * Scale the held item is squeezed to before it lifts — upstream's
 * `HOLD_ITEM_SCALE_DOWN_VALUE`. Shared by the in-place item (which squeezes to
 * it during the hold) and the lifted copy (which springs out of it), so the
 * handover between the two is invisible.
 */
export const HOLD_ITEM_SCALE = 0.95;

// ── Functions ────────────────────────────────────────────────────────────────

/**
 * Panel height from item metrics alone, without mounting it.
 *
 * The panel is positioned on the frame it opens, before `onLayout` can report
 * anything, so the first placement runs on this estimate; the measured height
 * replaces it a frame later and the spring absorbs the correction. It is exact
 * for single-line labels at default font scale — which is why rows are
 * `min-h-*` rather than fixed, so a larger accessibility font grows the row and
 * the measurement corrects the estimate rather than clipping the text.
 *
 * Counts the panel's border and the list's own vertical inset once, then a row
 * per item. Nothing is added between rows: the list runs them flush, and the
 * band that ends a group is the only thing that ever sits between two.
 */
export function estimateHoldMenuHeight(items: readonly HoldMenuHeightItem[]) {
  if (items.length === 0) return 0;
  let height = HOLD_MENU_BORDER_HEIGHT + HOLD_MENU_LIST_PADDING;
  for (const [index, item] of items.entries()) {
    height += item.heading ? HOLD_MENU_HEADING_HEIGHT : HOLD_MENU_ROW_HEIGHT;
    // A band ends a group, so the last row has nothing to end.
    if (item.separator && index < items.length - 1) height += HOLD_MENU_SEPARATOR_HEIGHT;
  }
  return height;
}

/**
 * Full placement for one open: side, alignment, position, width, travel and
 * transform origin.
 *
 * Everything is window-space, matching `measureInWindow`, so the caller can hand
 * `left`/`top` straight to an absolutely-positioned view inside a full-screen
 * `Modal`.
 */
export function resolveHoldMenuLayout({
  item,
  menuHeight,
  menuWidth,
  viewport,
  insets,
  side = 'auto',
  align = 'auto',
  disableMove = false,
}: HoldMenuLayoutInput): HoldMenuLayout {
  const width = Math.min(menuWidth, Math.max(0, viewport.width - insets.left - insets.right - HOLD_MENU_VIEWPORT_PADDING * 2));

  const resolvedSide = resolveSide({ side, item, menuHeight, viewport, insets });
  const resolvedAlign = resolveAlign({ align, item, viewport });
  const left = resolveLeft({ align: resolvedAlign, item, width, viewport, insets });

  // `disableMove` only pins the *item*; the panel is still capped to the room it
  // has, so an oversized menu scrolls rather than running off the edge.
  const travel = disableMove
    ? { shift: 0, maxHeight: spaceOn({ side: resolvedSide, item, viewport, insets }) }
    : resolveTravel({ side: resolvedSide, item, menuHeight, viewport, insets });

  // Never below one row: a panel clamped to nothing would be invisible, and the
  // held item is the thing that can afford to hang off the edge instead. The
  // border and the list's inset are part of what one visible row costs, so the
  // floor counts them — capped to the row alone, the inset would eat it.
  const maxHeight = Math.max(HOLD_MENU_MIN_PANEL_HEIGHT, travel.maxHeight);
  // The panel's own edge: `bottom` grows down from the item, so its top is fixed;
  // `top` grows up, so its top follows whatever height it ends up with.
  const height = Math.min(menuHeight, maxHeight);
  const top = resolvedSide === 'bottom' ? item.y + item.height + HOLD_MENU_GAP : item.y - HOLD_MENU_GAP - height;

  return {
    side: resolvedSide,
    align: resolvedAlign,
    left,
    top,
    width,
    shift: travel.shift,
    maxHeight,
    transformOrigin: menuTransformOrigin({ align: resolvedAlign, side: resolvedSide }),
  };
}
