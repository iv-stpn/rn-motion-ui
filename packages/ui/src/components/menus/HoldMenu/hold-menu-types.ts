import type { ReactElement, ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import type { TransformOriginAnchorPosition } from './hold-menu-layout';

/** One row of the menu — upstream's `MenuItemProps`, field for field. */
export type MenuItemProps = {
  /** Row label. Also the `actionParams` key, exactly as upstream. */
  text: string;
  /**
   * Icon for the row. A string is looked up through the provider's
   * `iconComponent`; a function renders whatever it returns.
   */
  icon?: string | (() => ReactElement);
  /** Called with the item's `actionParams` entry spread as arguments, then the menu closes. */
  // biome-ignore lint/suspicious/noExplicitAny: upstream's verbatim onPress signature — actionParams args arrive untyped; consumers type their own handlers
  onPress?: (...args: any[]) => void;
  /** Title rows are inert captions — no press, dimmed styling. */
  isTitle?: boolean;
  /** Destructive rows render in the destructive colour. */
  isDestructive?: boolean;
  /** Draws a separator band below this row. */
  withSeparator?: boolean;
};

/**
 * Props the provider's `iconComponent` accepts — a vector-icon-like component
 * mapping a `name` string to an icon, like `@expo/vector-icons`.
 */
export type HoldMenuIconComponentProps = { name: string; size?: number; color?: string; style?: unknown };

/** The provider's `iconComponent` — used to render items whose `icon` is a string. */
export type HoldMenuIconComponent = React.ComponentType<HoldMenuIconComponentProps>;

/** `HoldItem` props — upstream's `HoldItemProps`, plus a `testID` for testing. */
export type HoldItemProps = {
  /** The menu rows. An empty list makes the item inert. */
  items: MenuItemProps[];
  /**
   * Object keyed by item `text`, spread as arguments onto that item's `onPress`.
   *
   * @example
   * ```tsx
   * const items = [
   *   { text: 'Reply', onPress: (messageId: string) => reply(messageId) },
   *   { text: 'Copy', onPress: (text: string) => copy(text) },
   * ];
   * <HoldItem items={items} actionParams={{ Reply: [message.id], Copy: [message.text] }}>
   * ```
   */
  actionParams?: { [name: string]: unknown[] };
  children: ReactElement | ReactElement[];
  /**
   * Overrides the automatic anchor. The anchor is otherwise picked from which
   * half of the screen the item sits on.
   */
  menuAnchorPosition?: TransformOriginAnchorPosition;
  /**
   * Pins the item where it is. The panel then takes the whole overflow by
   * shrinking and scrolling rather than travelling.
   * @default false
   */
  disableMove?: boolean;
  /** Styles for the item wrapper — e.g. `{ maxWidth: '80%' }` for a chat bubble. */
  containerStyles?: ViewStyle | ViewStyle[];
  /**
   * Opens the menu above the item instead of below.
   * @default false
   */
  bottom?: boolean;
  /** How the menu is summoned. On web, `'hold'` is a right-click instead. */
  activateOn?: 'tap' | 'double-tap' | 'hold';
  /**
   * Haptic feedback on activation. `'None'` disables it. Falls back to a
   * platform buzz when `expo-haptics` is not installed (see
   * `hold-menu-haptics.native.ts`).
   */
  hapticFeedback?: 'None' | 'Selection' | 'Light' | 'Medium' | 'Heavy' | 'Success' | 'Warning' | 'Error';
  /** Whether a press on the lifted item dismisses the menu. */
  closeOnTap?: boolean;
  /**
   * Minimum hold before the menu opens, in ms.
   * @default 150
   */
  longPressMinDurationMs?: number;
  /**
   * Base testID for the item wrapper. The open menu derives its own testIDs
   * from it: `${testID}-panel`, `${testID}-menu-item-<text>` on the rows, and
   * `${testID}-backdrop` on the scrim.
   */
  testID?: string;
};

/** `HoldMenuProvider` props — upstream's, with `safeAreaInsets` optional. */
export type HoldMenuProviderProps = {
  /**
   * Theme of the menu — affects the backdrop and panel palette.
   * @default 'light'
   */
  theme?: 'dark' | 'light';
  /**
   * Vector-icon-like component mapping an icon `name` to an element, used to
   * render menu items whose `icon` is a string.
   */
  iconComponent?: HoldMenuIconComponent;
  /**
   * The app tree. Upstream types this as a single element; `ReactNode` is the
   * honest superset (a provider may wrap fragments or text nodes).
   */
  children: ReactNode;
  /**
   * Safe-area insets the menu keeps clear of. When omitted, the provider uses
   * `react-native-safe-area-context` if it is installed and falls back to
   * zeros — upstream requires this prop, here it is optional.
   */
  safeAreaInsets?: { top: number; right: number; bottom: number; left: number };
  /** Called when the menu becomes active. */
  onOpen?: () => void;
  /** Called when the menu ends. */
  onClose?: () => void;
};

/**
 * The shared values that drive the menu — what upstream's `MenuInternalProps`
 * carries from the activated `HoldItem` to the panel.
 */
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
  /** Base testID of the item that opened the menu — see `HoldItemProps.testID`. */
  testID?: string;
};
