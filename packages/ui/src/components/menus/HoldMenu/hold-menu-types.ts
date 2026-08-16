import type { ComponentType, ReactElement, ReactNode } from 'react';
import type { ViewStyle } from 'react-native';

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
  transformValue: number;
  actionParams: { [name: string]: unknown[] };
};

/** Props the provider's `iconComponent` accepts — a vector-icon-like contract. */
export type HoldMenuIconComponentProps = { name: string; size?: number; color?: string; style?: unknown };

/** The provider's `iconComponent` — maps an icon `name` string to an element. */
export type HoldMenuIconComponent = ComponentType<HoldMenuIconComponentProps>;

/** Upstream's haptic feedback style names, verbatim. */
export type HoldMenuHapticFeedback = 'None' | 'Selection' | 'Light' | 'Medium' | 'Heavy' | 'Success' | 'Warning' | 'Error';

/** Safe-area insets the menu keeps clear of. */
export type HoldMenuSafeAreaInsets = { top: number; right: number; bottom: number; left: number };

/** `HoldItem` props — upstream's `HoldItemProps`, field for field. */
export type HoldItemProps = {
  /** The menu rows. An empty list makes the item inert. */
  items: MenuItemProps[];
  /** Object keyed by item `text`, spread as arguments onto that item's `onPress`. */
  actionParams?: { [name: string]: unknown[] };
  children: ReactElement | ReactElement[];
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
};
