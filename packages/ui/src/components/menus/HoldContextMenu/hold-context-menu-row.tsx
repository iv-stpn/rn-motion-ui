// biome-ignore-all lint/style/useExportsLast: the item type heads the module so the row components below read against it
/**
 * One row of a `HoldContextMenu` panel, plus the group separator band.
 *
 * Ported from react-native-hold-menu's `menu/MenuItem.tsx` and
 * `menu/Separator.tsx`. The iOS layout it draws — label left, icon right, a
 * hairline between rows — is what the upstream component does with its own
 * light/dark palette; here every colour is a theme token, so the panel tracks
 * the app's scheme instead of a `theme="light" | "dark"` prop.
 *
 * Row heights are `min-h-*`, not fixed: a large accessibility font must grow the
 * row rather than clip the label. The metrics in `hold-context-menu-layout.ts`
 * mirror these classes and are kept in sync by hand — the pre-layout height
 * estimate reads from them.
 */

import type { ComponentType, ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { cn } from '../../../lib/cn';
import type { IconProps } from '../../../lib/icons';
import { ThemedIcon } from '../../icon/themed-icon';
import { Text } from '../../typography/Text/text';

/** Trailing icon renderer — any component taking the library's `IconProps`. */
export type HoldContextMenuIcon = ComponentType<IconProps>;

export type HoldContextMenuItem = {
  /** Stable identity for the row. Also used to build its testID. */
  id: string;
  /** Row label. A string keeps the row single-line; a node is rendered as-is. */
  label: ReactNode;
  /** Trailing icon, drawn at the row's end in the label's colour. */
  icon?: HoldContextMenuIcon;
  /** Runs on press. The panel closes first, so navigation here is safe. */
  onPress?: () => void;
  /**
   * Renders as a non-pressable caption instead of an action — upstream's
   * `isTitle`. Use it to name the held item or label a group.
   */
  heading?: boolean;
  /** Paints the label and icon in the `danger` token — upstream's `isDestructive`. */
  destructive?: boolean;
  /** Greys the row out and blocks the press, and says so to assistive tech. */
  disabled?: boolean;
  /**
   * Ends a group: an 8 px band below this row instead of the hairline divider.
   * Ignored on the last row. Upstream's `withSeparator`.
   */
  separator?: boolean;
  /** Overrides the announced name when `label` is a node rather than a string. */
  accessibilityLabel?: string;
};

/** The 8 px band that ends a group — upstream's `Separator`. */
export function HoldContextMenuSeparator() {
  // `h-2` — mirrored by HOLD_MENU_SEPARATOR_HEIGHT.
  return <View className="h-2 w-full bg-border/60" />;
}

export type HoldContextMenuRowProps = {
  item: HoldContextMenuItem;
  /** Suppresses the trailing divider (the panel's last row draws none). */
  isLast?: boolean;
  onSelect: (item: HoldContextMenuItem) => void;
  testID?: string;
};

export function HoldContextMenuRow({ item, isLast = false, onSelect, testID }: HoldContextMenuRowProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const handlePress = useCallback(() => onSelect(item), [item, onSelect]);
  const handleHoverIn = useCallback(() => setHovered(true), []);
  const handleHoverOut = useCallback(() => setHovered(false), []);
  const handlePressIn = useCallback(() => setPressed(true), []);
  const handlePressOut = useCallback(() => setPressed(false), []);

  // A band and a divider would stack, so the band wins; the last row gets neither.
  const divider = !(isLast || item.separator) && 'border-border/60 border-b';

  if (item.heading)
    return (
      <View
        // Not a menuitem — it does nothing when pressed. `presentation` drops the
        // wrapper from the tree while leaving its text readable, so a screen
        // reader still reaches the caption without being offered a dead command.
        role="presentation"
        // `min-h-[34px]` — mirrored by HOLD_MENU_HEADING_HEIGHT.
        className={cn('min-h-[34px] justify-center px-4 py-1.5', divider)}
        testID={testID}
      >
        <Text className="text-center text-muted-foreground" numberOfLines={1} size="xs">
          {item.label}
        </Text>
      </View>
    );

  const tint = item.destructive ? 'text-danger' : 'text-foreground';

  return (
    <Pressable
      accessibilityLabel={item.accessibilityLabel}
      accessibilityRole="menuitem"
      // `disabled` carries the state to both a11y trees and blocks the press;
      // dimming alone would leave the row announced as live.
      aria-disabled={item.disabled}
      className={cn(
        // `min-h-11` — mirrored by HOLD_MENU_ROW_HEIGHT.
        'min-h-11 flex-row items-center gap-3 px-4 py-2.5',
        divider,
        item.disabled && 'opacity-40',
        !item.disabled && hovered && 'bg-surface-hover',
        !item.disabled && pressed && 'bg-surface-selected',
      )}
      disabled={item.disabled}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      testID={testID}
    >
      <Text className={cn('flex-1', tint)} numberOfLines={1} size="base">
        {item.label}
      </Text>
      {item.icon ? <ThemedIcon icon={item.icon} size={18} token={item.destructive ? 'danger' : 'foreground'} /> : null}
    </Pressable>
  );
}
