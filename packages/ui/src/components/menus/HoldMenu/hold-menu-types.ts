import type { ComponentType, ReactElement, ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import type { HapticFeedbackVariant } from '../../../lib/haptics-types';
import type { DragEffectAllowed, DragEndEvent, DragGroups, DragStartEvent } from '../../gestures/drag.types';
import type { OverlayType } from '../Overlay/overlay-type';

/** Which corner the menu grows out of and which edge it opens on. `top-*` below the item, `bottom-*` above. */
export type TransformOriginAnchorPosition =
  | 'top-right'
  | 'top-left'
  | 'top-center'
  | 'bottom-right'
  | 'bottom-left'
  | 'bottom-center';

/** One row of the menu — upstream's `MenuItemProps`, field for field. */
export type MenuItemProps = {
  /** Row label. Also the `actionParams` key, exactly as upstream. */
  text: string;
  /** Icon for the row — a string is looked up through the provider's `iconComponent`, a function renders itself. */
  icon?: string | (() => ReactElement);
  /** Called with the item's `actionParams` entry spread as arguments, then the menu closes. */
  // biome-ignore lint/suspicious/noExplicitAny: upstream's verbatim onPress signature — actionParams args arrive untyped
  onPress?: (...args: any[]) => void;
  /** Title rows are inert captions — no press, dimmed styling. */
  isTitle?: boolean;
  /** Destructive rows render in the destructive colour. */
  isDestructive?: boolean;
  /** Draws a separator band below this row. */
  withSeparator?: boolean;
  /** Greys the row out and blocks the press. */
  disabled?: boolean;
};

/** The values that drive the menu — upstream's `MenuInternalProps`. */
export type MenuInternalProps = {
  items: MenuItemProps[];
  itemHeight: number;
  itemWidth: number;
  itemY: number;
  itemX: number;
  anchorPosition: TransformOriginAnchorPosition;
  menuHeight: number;
  menuWidth: number;
  transformValue: number;
  actionParams: { [name: string]: unknown[] };
};

/** Props the provider's `iconComponent` accepts — a vector-icon-like contract. */
export type HoldMenuIconComponentProps = { name: string; size?: number; color?: string; style?: unknown };

/** The provider's `iconComponent` — maps an icon `name` string to an element. */
export type HoldMenuIconComponent = ComponentType<HoldMenuIconComponentProps>;

/** Upstream's haptic feedback style names, verbatim. */
export type HoldMenuHapticFeedback = HapticFeedbackVariant;

/** Safe-area insets the menu keeps clear of. */
export type HoldMenuSafeAreaInsets = { top: number; right: number; bottom: number; left: number };

/**
 * The drag options that wire a drag gesture into a `HoldItem`'s hold.
 *
 * When provided, a move past `escapeSlop` after the hold fires lifts a drag:
 * the hold still opens the menu, and an escape closes the menu (and its overlay)
 * before the drag takes over. Native-only — on web the menu is a right-click and
 * there is no hold gesture to upgrade.
 */
export type HoldItemDragOptions = {
  data: Record<string, string>;
  effectAllowed?: DragEffectAllowed;
  groups?: DragGroups;
  /** Override the drag ghost. Forwarded to the drag source's `preview`. */
  preview?: ReactNode;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragStart?: (event: DragStartEvent) => void;
};

/** `HoldItem` props — upstream's `HoldItemProps`, plus the drag/hold callbacks the file-system needs. */
export type HoldItemProps = {
  /** The menu rows. An empty list makes the item inert. */
  items: MenuItemProps[];
  /** Object keyed by item `text`, spread as arguments onto that item's `onPress`. */
  actionParams?: { [name: string]: unknown[] };
  /** The item's content, lifted into the portal twin while the menu is open. */
  children: ReactNode;
  /** Overrides the automatic anchor. Otherwise picked from which half of the screen the item sits on. */
  menuAnchorPosition?: TransformOriginAnchorPosition;
  /** Pins the item where it is — the panel takes the whole overflow instead of travelling. */
  disableMove?: boolean;
  /** Styles for the item wrapper — e.g. `{ maxWidth: '80%' }` for a chat bubble. */
  containerStyles?: ViewStyle | ViewStyle[];
  /** Opens the menu above the item instead of below. @default false */
  bottom?: boolean;
  /** How the menu is summoned. @default 'hold' */
  activateOn?: 'tap' | 'double-tap' | 'hold';
  /** Haptic feedback on activation. `'None'` disables it. */
  hapticFeedback?: HoldMenuHapticFeedback;
  /** Whether a press on the lifted item dismisses the menu. */
  closeOnTap?: boolean;
  /** Minimum hold before the menu opens, in ms. @default 150 */
  longPressMinDurationMs?: number;
  /**
   * Drag options that upgrade the hold to a drag source. Native-only — the hold
   * still opens the menu, and a move past `escapeSlop` closes it before the drag
   * takes over.
   */
  dragOptions?: HoldItemDragOptions;
  /**
   * Fires when a hold lands, right after the menu opens — one gesture, both
   * outcomes. Use it for an action that should ride the same hold (e.g. a
   * multi-select toggle). Fires even when `items` is empty, so the hold keeps
   * meaning something to the consumer when the menu is inert.
   */
  onHold?: () => void;
  /** Called when the menu opens and when it closes. */
  onOpenChange?: (open: boolean) => void;
  /** Inert trigger — no activation, no menu, no drag. */
  disabled?: boolean;
  /** Base testID for the trigger wrapper. */
  testID?: string;
};

/** `HoldMenuProvider` props — upstream's `HoldMenuProviderProps`, with `safeAreaInsets` optional. */
export type HoldMenuProviderProps = {
  /** Theme of the menu — affects the backdrop and panel palette. @default 'light' */
  theme?: 'dark' | 'light';
  /** Vector-icon-like component mapping an icon `name` to an element. */
  iconComponent?: HoldMenuIconComponent;
  children: ReactNode;
  /** Safe-area insets the menu keeps clear of. @default zeros */
  safeAreaInsets?: HoldMenuSafeAreaInsets;
  /** Called when the menu becomes active. */
  onOpen?: () => void;
  /** Called when the menu ends. */
  onClose?: () => void;
  /** The scrim behind the menu: `"blur"`, `"opacity"`, or `"none"`. Defaults to `"blur"`. */
  overlay?: OverlayType;
  /** When false, tapping the backdrop will not close the menu. Defaults to true. */
  closeOnOutsidePress?: boolean;
};
